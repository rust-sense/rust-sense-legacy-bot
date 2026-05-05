import { Pool, type PoolClient } from 'pg';
import { buildDefaultGeneralSettings, buildDefaultNotificationSettings } from '../domain/guildSettings.js';
import { addServerLite, createEmptyInstance } from '../domain/guildState.js';
import type {
    Alias,
    Credentials,
    Instance,
    Marker,
    Server,
    SmartAlarm,
    SmartSwitch,
    StorageMonitor,
    SwitchGroup,
    Tracker,
} from '../types/instance.js';
import {
    applyPersistedGuildSetting,
    PERSISTED_GUILD_SETTING_DEFINITIONS,
    readGuildSettingValue,
    serializeGuildSettingValue,
} from './guildSettingsRegistry.js';
import { JsonAdapter } from './JsonAdapter.js';
import { migrateFromJsonAdapter } from './jsonMigration.js';
import { persistenceLogger } from './logger.js';
import {
    CHANNEL_ID_KEYS,
    credentialEntries,
    dbBool,
    fromDbBool,
    INFORMATION_MESSAGE_ID_KEYS,
    normalizeTracker,
} from './relational/mapping.js';
import type {
    DiscordReferenceUpdate,
    GuildCollectionsState,
    GuildCorePatch,
    GuildCoreState,
    GuildSettingsState,
    GuildSettingUpdate,
    PersistenceAdapter,
    SmartAlarmPatch,
    SmartSwitchGroupPatch,
    SmartSwitchPatch,
    StorageMonitorPatch,
} from './types.js';

type Row = Record<string, any>;

export class PostgresAdapter implements PersistenceAdapter {
    readonly name = 'postgres' as const;
    private pool: Pool | null = null;

    constructor(
        private readonly connectionString: string,
        private readonly migrateLegacyJsonOnInit = true,
    ) {}

    async init(): Promise<void> {
        this.pool = new Pool({ connectionString: this.connectionString });
        await this.validateMigrated();
        if (this.migrateLegacyJsonOnInit) {
            await this.migrateLegacyJson();
        } else {
            persistenceLogger.info(
                '[persistence] Legacy JSON migration is disabled for Postgres by RPP_MIGRATE_LEGACY_JSON=false.',
            );
        }
    }

    async close(): Promise<void> {
        await this.pool?.end();
        this.pool = null;
    }

    async listGuildIds(): Promise<string[]> {
        return (await this.rows('SELECT guild_id FROM guilds ORDER BY guild_id')).map((row) => row.guild_id);
    }

    async hasGuild(guildId: string): Promise<boolean> {
        return Boolean((await this.rows('SELECT 1 FROM guilds WHERE guild_id = ?', [guildId]))[0]);
    }

    async readGuildCore(guildId: string): Promise<GuildCoreState> {
        const guild = (await this.rows('SELECT * FROM guilds WHERE guild_id = ?', [guildId]))[0];
        if (!guild) throw new Error(`No persisted guild state found for ${guildId}`);
        return {
            firstTime: fromDbBool(guild.first_time),
            role: guild.role_id,
            adminRole: guild.admin_role_id,
            activeServer: guild.active_server_id,
            channelId: await this.readChannelIds(guildId),
            informationMessageId: await this.readInformationMessageIds(guildId),
        };
    }

    async writeGuildCore(guildId: string, core: GuildCoreState): Promise<void> {
        await this.withTransaction((client) => this.writeGuild(client, guildId, core));
    }

    async updateGuildCoreFields(guildId: string, patch: GuildCorePatch): Promise<void> {
        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['firstTime', 'first_time'],
            ['role', 'role_id'],
            ['adminRole', 'admin_role_id'],
            ['activeServer', 'active_server_id'],
        ] as const) {
            if (property in patch) {
                updates.push(`${column} = ?`);
                values.push(property === 'firstTime' ? dbBool(patch[property]) : patch[property]);
            }
        }
        if (updates.length === 0) return;
        await this.run(this.database(), `UPDATE guilds SET ${updates.join(', ')} WHERE guild_id = ?`, [
            ...values,
            guildId,
        ]);
    }

    async readGuildSettings(guildId: string): Promise<GuildSettingsState> {
        if (!(await this.hasGuild(guildId))) throw new Error(`No persisted guild state found for ${guildId}`);
        const instance = createEmptyInstance();
        await this.readSettings(guildId, instance);
        return {
            generalSettings: instance.generalSettings,
            notificationSettings: instance.notificationSettings,
        };
    }

    async writeGuildSettings(guildId: string, settings: GuildSettingsState): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM guild_settings WHERE guild_id = ?', [guildId]);
            await this.writeSettings(client, guildId, settings);
        });
    }

    async setGuildSettings(guildId: string, updates: GuildSettingUpdate[]): Promise<void> {
        if (updates.length === 0) return;
        await this.withTransaction(async (client) => {
            const placeholders = updates.map(() => '(?, ?, ?)').join(', ');
            await this.run(
                client,
                `INSERT INTO guild_settings (guild_id, setting_key, setting_value)
                VALUES ${placeholders}
                ON CONFLICT(guild_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
                updates.flatMap((update) => [guildId, update.key, update.value]),
            );
        });
    }

    async setDiscordReferencedIds(guildId: string, updates: DiscordReferenceUpdate[]): Promise<void> {
        if (updates.length === 0) return;
        const upserts = updates.filter((update) => update.value !== null);
        const deletes = updates.filter((update) => update.value === null);

        await this.withTransaction(async (client) => {
            if (upserts.length > 0) {
                const placeholders = upserts.map(() => '(?, ?, ?)').join(', ');
                await this.run(
                    client,
                    `INSERT INTO guild_discord_ids (guild_id, id_key, id_value)
                    VALUES ${placeholders}
                    ON CONFLICT(guild_id, id_key) DO UPDATE SET id_value = EXCLUDED.id_value`,
                    upserts.flatMap((update) => [guildId, update.key, update.value]),
                );
            }

            if (deletes.length > 0) {
                await this.run(
                    client,
                    `DELETE FROM guild_discord_ids WHERE guild_id = ? AND id_key IN (${deletes.map(() => '?').join(', ')})`,
                    [guildId, ...deletes.map((update) => update.key)],
                );
            }
        });
    }

    async readServers(guildId: string): Promise<Record<string, Server>> {
        const instance = createEmptyInstance();
        await this.hydrateServers(guildId, instance);
        return instance.serverList;
    }

    async readServerLiteEntries(guildId: string): Promise<Instance['serverListLite']> {
        const serverListLite: Instance['serverListLite'] = {};
        for (const row of await this.rows('SELECT * FROM server_lite_entries WHERE guild_id = ?', [guildId])) {
            if (!serverListLite[row.server_id]) serverListLite[row.server_id] = {};
            serverListLite[row.server_id][row.steam_id] = {
                serverIp: row.server_ip,
                appPort: row.app_port,
                steamId: row.steam_id,
                playerToken: row.player_token,
            };
        }
        return serverListLite;
    }

    async replaceServerTimeSamples(
        guildId: string,
        serverId: string,
        timeTillDay: Server['timeTillDay'],
        timeTillNight: Server['timeTillNight'],
    ): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM server_time_samples WHERE guild_id = ? AND server_id = ?', [
                guildId,
                serverId,
            ]);

            const entries = (
                [
                    ['day', timeTillDay],
                    ['night', timeTillNight],
                ] as const
            ).flatMap(([phase, samples]) =>
                Object.entries(samples ?? {}).map(([sampleKey, seconds]) => [
                    guildId,
                    serverId,
                    phase,
                    sampleKey,
                    seconds,
                ]),
            );

            if (entries.length > 0) {
                await this.run(
                    client,
                    `INSERT INTO server_time_samples (guild_id, server_id, phase, sample_key, seconds)
                    VALUES ${entries.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
                    entries.flat(),
                );
            }
        });
    }

    async setServerMessageId(guildId: string, serverId: string, messageId: string | null): Promise<void> {
        await this.run(this.database(), 'UPDATE servers SET message_id = ? WHERE guild_id = ? AND server_id = ?', [
            messageId,
            guildId,
            serverId,
        ]);
    }

    async updateServerFields(
        guildId: string,
        serverId: string,
        patch: Parameters<PersistenceAdapter['updateServerFields']>[2],
    ): Promise<void> {
        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['battlemetricsId', 'battlemetrics_id'],
            ['connect', 'connect'],
            ['cargoShipEgressTimeMs', 'cargo_ship_egress_time_ms'],
            ['oilRigLockedCrateUnlockTimeMs', 'oil_rig_locked_crate_unlock_time_ms'],
            ['deepSeaMinWipeCooldownMs', 'deep_sea_min_wipe_cooldown_ms'],
            ['deepSeaMaxWipeCooldownMs', 'deep_sea_max_wipe_cooldown_ms'],
            ['deepSeaWipeDurationMs', 'deep_sea_wipe_duration_ms'],
        ] as const) {
            if (property in patch) {
                updates.push(`${column} = ?`);
                values.push(patch[property]);
            }
        }
        if (updates.length === 0) return;
        await this.run(
            this.database(),
            `UPDATE servers SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ?`,
            [...values, guildId, serverId],
        );
    }

    async upsertServer(guildId: string, serverId: string, server: Server): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM servers WHERE guild_id = ? AND server_id = ?', [guildId, serverId]);
            await this.writeServers(client, guildId, { serverList: { [serverId]: server } } as Instance);
        });
    }

    async deleteServer(guildId: string, serverId: string): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM server_lite_entries WHERE guild_id = ? AND server_id = ?', [
                guildId,
                serverId,
            ]);
            await this.run(client, 'DELETE FROM servers WHERE guild_id = ? AND server_id = ?', [guildId, serverId]);
        });
    }

    async upsertServerLiteEntry(
        guildId: string,
        serverId: string,
        steamId: string,
        entry: Parameters<PersistenceAdapter['upsertServerLiteEntry']>[3],
    ): Promise<void> {
        await this.run(
            this.database(),
            `INSERT INTO server_lite_entries (guild_id, server_id, steam_id, server_ip, app_port, player_token)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, server_id, steam_id) DO UPDATE SET
                server_ip = EXCLUDED.server_ip,
                app_port = EXCLUDED.app_port,
                player_token = EXCLUDED.player_token`,
            [guildId, serverId, steamId, entry.serverIp, entry.appPort, entry.playerToken],
        );
    }

    async upsertMarker(
        guildId: string,
        serverId: string,
        markerKey: string,
        marker: Parameters<PersistenceAdapter['upsertMarker']>[3],
    ): Promise<void> {
        await this.run(
            this.database(),
            `INSERT INTO markers (guild_id, server_id, marker_key, x, y, location)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, server_id, marker_key) DO UPDATE SET
                x = EXCLUDED.x,
                y = EXCLUDED.y,
                location = EXCLUDED.location`,
            [guildId, serverId, markerKey, marker.x, marker.y, marker.location],
        );
    }

    async deleteMarker(guildId: string, serverId: string, markerKey: string): Promise<void> {
        await this.run(this.database(), 'DELETE FROM markers WHERE guild_id = ? AND server_id = ? AND marker_key = ?', [
            guildId,
            serverId,
            markerKey,
        ]);
    }

    async upsertNote(guildId: string, serverId: string, noteId: string | number, note: string): Promise<void> {
        await this.run(
            this.database(),
            `INSERT INTO notes (guild_id, server_id, note_id, note)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id, server_id, note_id) DO UPDATE SET note = EXCLUDED.note`,
            [guildId, serverId, noteId, note],
        );
    }

    async deleteNote(guildId: string, serverId: string, noteId: string | number): Promise<void> {
        await this.run(this.database(), 'DELETE FROM notes WHERE guild_id = ? AND server_id = ? AND note_id = ?', [
            guildId,
            serverId,
            noteId,
        ]);
    }

    async setTrackerMessageId(guildId: string, trackerId: string, messageId: string | null): Promise<void> {
        await this.run(this.database(), 'UPDATE trackers SET message_id = ? WHERE guild_id = ? AND tracker_id = ?', [
            messageId,
            guildId,
            trackerId,
        ]);
    }

    async updateTrackerFields(
        guildId: string,
        trackerId: string,
        patch: Parameters<PersistenceAdapter['updateTrackerFields']>[2],
    ): Promise<void> {
        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['name', 'name'],
            ['battlemetricsId', 'battlemetrics_id'],
            ['clanTag', 'clan_tag'],
            ['img', 'img'],
            ['title', 'title'],
            ['serverId', 'server_id'],
            ['everyone', 'everyone'],
            ['inGame', 'in_game'],
        ] as const) {
            if (property in patch) {
                updates.push(`${column} = ?`);
                values.push(typeof patch[property] === 'boolean' ? dbBool(patch[property]) : patch[property]);
            }
        }
        if (updates.length === 0) return;
        await this.run(
            this.database(),
            `UPDATE trackers SET ${updates.join(', ')} WHERE guild_id = ? AND tracker_id = ?`,
            [...values, guildId, trackerId],
        );
    }

    async upsertTracker(guildId: string, trackerId: string, tracker: Tracker): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(
                client,
                `INSERT INTO trackers (
                    guild_id, tracker_id, id, name, battlemetrics_id, status, last_screenshot, last_online, last_wipe,
                    message_id, clan_tag, everyone, in_game, img, title, server_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, tracker_id) DO UPDATE SET
                    id = EXCLUDED.id,
                    name = EXCLUDED.name,
                    battlemetrics_id = EXCLUDED.battlemetrics_id,
                    status = EXCLUDED.status,
                    last_screenshot = EXCLUDED.last_screenshot,
                    last_online = EXCLUDED.last_online,
                    last_wipe = EXCLUDED.last_wipe,
                    message_id = EXCLUDED.message_id,
                    clan_tag = EXCLUDED.clan_tag,
                    everyone = EXCLUDED.everyone,
                    in_game = EXCLUDED.in_game,
                    img = EXCLUDED.img,
                    title = EXCLUDED.title,
                    server_id = EXCLUDED.server_id`,
                [
                    guildId,
                    trackerId,
                    tracker.id,
                    tracker.name,
                    tracker.battlemetricsId,
                    dbBool(tracker.status),
                    tracker.lastScreenshot,
                    tracker.lastOnline,
                    tracker.lastWipe,
                    tracker.messageId,
                    tracker.clanTag,
                    dbBool(tracker.everyone),
                    dbBool(tracker.inGame),
                    tracker.img ?? null,
                    tracker.title ?? null,
                    tracker.serverId ?? null,
                ],
            );
            await this.run(client, 'DELETE FROM tracker_players WHERE guild_id = ? AND tracker_id = ?', [
                guildId,
                trackerId,
            ]);
            if (tracker.players.length > 0) {
                await this.run(
                    client,
                    `INSERT INTO tracker_players (guild_id, tracker_id, player_index, name, steam_id, player_id)
                    VALUES ${tracker.players.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
                    tracker.players.flatMap((player, index) => [
                        guildId,
                        trackerId,
                        index,
                        player.name ?? null,
                        player.steamId,
                        player.playerId,
                    ]),
                );
            }
        });
    }

    async deleteTracker(guildId: string, trackerId: string): Promise<void> {
        await this.run(this.database(), 'DELETE FROM trackers WHERE guild_id = ? AND tracker_id = ?', [
            guildId,
            trackerId,
        ]);
    }

    async replaceTrackerPlayers(guildId: string, trackerId: string, players: Tracker['players']): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM tracker_players WHERE guild_id = ? AND tracker_id = ?', [
                guildId,
                trackerId,
            ]);
            if (players.length > 0) {
                await this.run(
                    client,
                    `INSERT INTO tracker_players (guild_id, tracker_id, player_index, name, steam_id, player_id)
                    VALUES ${players.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
                    players.flatMap((player, index) => [
                        guildId,
                        trackerId,
                        index,
                        player.name ?? null,
                        player.steamId,
                        player.playerId,
                    ]),
                );
            }
        });
    }

    async setSmartSwitchMessageId(
        guildId: string,
        serverId: string,
        switchId: string,
        messageId: string | null,
    ): Promise<void> {
        await this.run(
            this.database(),
            'UPDATE smart_switches SET message_id = ? WHERE guild_id = ? AND server_id = ? AND switch_id = ?',
            [messageId, guildId, serverId, switchId],
        );
    }

    async updateSmartSwitchFields(
        guildId: string,
        serverId: string,
        switchId: string,
        patch: SmartSwitchPatch,
    ): Promise<void> {
        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['name', 'name'],
            ['active', 'active'],
            ['reachable', 'reachable'],
            ['location', 'location'],
            ['x', 'x'],
            ['y', 'y'],
            ['command', 'command'],
            ['autoDayNightOnOff', 'auto_day_night_on_off'],
            ['proximity', 'proximity'],
            ['image', 'image'],
            ['everyone', 'everyone'],
        ] as const) {
            if (property in patch) {
                updates.push(`${column} = ?`);
                values.push(typeof patch[property] === 'boolean' ? dbBool(patch[property]) : patch[property]);
            }
        }
        if (updates.length === 0) return;
        await this.run(
            this.database(),
            `UPDATE smart_switches SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ? AND switch_id = ?`,
            [...values, guildId, serverId, switchId],
        );
    }

    async upsertSmartSwitch(
        guildId: string,
        serverId: string,
        switchId: string,
        smartSwitch: SmartSwitch,
    ): Promise<void> {
        await this.run(
            this.database(),
            `INSERT INTO smart_switches (
                guild_id, server_id, switch_id, name, active, reachable, location, x, y, image, command,
                auto_day_night_on_off, proximity, message_id, everyone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, server_id, switch_id) DO UPDATE SET
                name = EXCLUDED.name,
                active = EXCLUDED.active,
                reachable = EXCLUDED.reachable,
                location = EXCLUDED.location,
                x = EXCLUDED.x,
                y = EXCLUDED.y,
                image = EXCLUDED.image,
                command = EXCLUDED.command,
                auto_day_night_on_off = EXCLUDED.auto_day_night_on_off,
                proximity = EXCLUDED.proximity,
                message_id = EXCLUDED.message_id,
                everyone = EXCLUDED.everyone`,
            [
                guildId,
                serverId,
                switchId,
                smartSwitch.name,
                dbBool(smartSwitch.active),
                dbBool(smartSwitch.reachable),
                smartSwitch.location,
                smartSwitch.x,
                smartSwitch.y,
                smartSwitch.image,
                smartSwitch.command,
                smartSwitch.autoDayNightOnOff,
                smartSwitch.proximity,
                smartSwitch.messageId,
                smartSwitch.everyone == null ? null : dbBool(smartSwitch.everyone),
            ],
        );
    }

    async deleteSmartSwitch(guildId: string, serverId: string, switchId: string): Promise<void> {
        await this.run(
            this.database(),
            'DELETE FROM smart_switches WHERE guild_id = ? AND server_id = ? AND switch_id = ?',
            [guildId, serverId, switchId],
        );
    }

    async setSmartAlarmMessageId(
        guildId: string,
        serverId: string,
        alarmId: string,
        messageId: string | null,
    ): Promise<void> {
        await this.run(
            this.database(),
            'UPDATE smart_alarms SET message_id = ? WHERE guild_id = ? AND server_id = ? AND alarm_id = ?',
            [messageId, guildId, serverId, alarmId],
        );
    }

    async updateSmartAlarmFields(
        guildId: string,
        serverId: string,
        alarmId: string,
        patch: SmartAlarmPatch,
    ): Promise<void> {
        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['name', 'name'],
            ['active', 'active'],
            ['reachable', 'reachable'],
            ['location', 'location'],
            ['x', 'x'],
            ['y', 'y'],
            ['lastTrigger', 'last_trigger'],
            ['message', 'message'],
            ['command', 'command'],
            ['inGame', 'in_game'],
            ['image', 'image'],
            ['everyone', 'everyone'],
        ] as const) {
            if (property in patch) {
                updates.push(`${column} = ?`);
                values.push(typeof patch[property] === 'boolean' ? dbBool(patch[property]) : patch[property]);
            }
        }
        if (updates.length === 0) return;
        await this.run(
            this.database(),
            `UPDATE smart_alarms SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ? AND alarm_id = ?`,
            [...values, guildId, serverId, alarmId],
        );
    }

    async upsertSmartAlarm(guildId: string, serverId: string, alarmId: string, smartAlarm: SmartAlarm): Promise<void> {
        await this.run(
            this.database(),
            `INSERT INTO smart_alarms (
                guild_id, server_id, alarm_id, name, active, reachable, location, x, y, image, message, command,
                last_trigger, in_game, message_id, everyone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, server_id, alarm_id) DO UPDATE SET
                name = EXCLUDED.name,
                active = EXCLUDED.active,
                reachable = EXCLUDED.reachable,
                location = EXCLUDED.location,
                x = EXCLUDED.x,
                y = EXCLUDED.y,
                image = EXCLUDED.image,
                message = EXCLUDED.message,
                command = EXCLUDED.command,
                last_trigger = EXCLUDED.last_trigger,
                in_game = EXCLUDED.in_game,
                message_id = EXCLUDED.message_id,
                everyone = EXCLUDED.everyone`,
            [
                guildId,
                serverId,
                alarmId,
                smartAlarm.name,
                dbBool(smartAlarm.active),
                dbBool(smartAlarm.reachable),
                smartAlarm.location,
                smartAlarm.x,
                smartAlarm.y,
                smartAlarm.image,
                smartAlarm.message,
                smartAlarm.command,
                smartAlarm.lastTrigger,
                dbBool(smartAlarm.inGame),
                smartAlarm.messageId,
                dbBool(smartAlarm.everyone),
            ],
        );
    }

    async deleteSmartAlarm(guildId: string, serverId: string, alarmId: string): Promise<void> {
        await this.run(
            this.database(),
            'DELETE FROM smart_alarms WHERE guild_id = ? AND server_id = ? AND alarm_id = ?',
            [guildId, serverId, alarmId],
        );
    }

    async setStorageMonitorMessageId(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        messageId: string | null,
    ): Promise<void> {
        await this.run(
            this.database(),
            'UPDATE storage_monitors SET message_id = ? WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
            [messageId, guildId, serverId, storageMonitorId],
        );
    }

    async updateStorageMonitorFields(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        patch: StorageMonitorPatch,
    ): Promise<void> {
        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['name', 'name'],
            ['reachable', 'reachable'],
            ['location', 'location'],
            ['x', 'x'],
            ['y', 'y'],
            ['type', 'type'],
            ['capacity', 'capacity'],
            ['decaying', 'decaying'],
            ['inGame', 'in_game'],
            ['image', 'image'],
            ['everyone', 'everyone'],
            ['upkeep', 'upkeep'],
        ] as const) {
            if (property in patch) {
                updates.push(`${column} = ?`);
                values.push(typeof patch[property] === 'boolean' ? dbBool(patch[property]) : patch[property]);
            }
        }
        if (updates.length === 0) return;
        await this.run(
            this.database(),
            `UPDATE storage_monitors SET ${updates.join(', ')}
            WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?`,
            [...values, guildId, serverId, storageMonitorId],
        );
    }

    async upsertStorageMonitor(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        storageMonitor: StorageMonitor,
    ): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(
                client,
                `INSERT INTO storage_monitors (
                    guild_id, server_id, storage_monitor_id, name, type, image, reachable, location, x, y, capacity,
                    decaying, in_game, message_id, everyone, upkeep
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, storage_monitor_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    type = EXCLUDED.type,
                    image = EXCLUDED.image,
                    reachable = EXCLUDED.reachable,
                    location = EXCLUDED.location,
                    x = EXCLUDED.x,
                    y = EXCLUDED.y,
                    capacity = EXCLUDED.capacity,
                    decaying = EXCLUDED.decaying,
                    in_game = EXCLUDED.in_game,
                    message_id = EXCLUDED.message_id,
                    everyone = EXCLUDED.everyone,
                    upkeep = EXCLUDED.upkeep`,
                [
                    guildId,
                    serverId,
                    storageMonitorId,
                    storageMonitor.name,
                    storageMonitor.type,
                    storageMonitor.image,
                    dbBool(storageMonitor.reachable),
                    storageMonitor.location,
                    storageMonitor.x,
                    storageMonitor.y,
                    storageMonitor.capacity,
                    storageMonitor.decaying == null ? null : dbBool(storageMonitor.decaying),
                    storageMonitor.inGame == null ? null : dbBool(storageMonitor.inGame),
                    storageMonitor.messageId,
                    dbBool(storageMonitor.everyone),
                    storageMonitor.upkeep ?? null,
                ],
            );
            await this.run(
                client,
                'DELETE FROM storage_monitor_items WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
                [guildId, serverId, storageMonitorId],
            );
            if ((storageMonitor.items ?? []).length > 0) {
                await this.run(
                    client,
                    `INSERT INTO storage_monitor_items (guild_id, server_id, storage_monitor_id, item_id, quantity)
                    VALUES ${(storageMonitor.items ?? []).map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
                    (storageMonitor.items ?? []).flatMap((item) => [
                        guildId,
                        serverId,
                        storageMonitorId,
                        item.itemId,
                        item.quantity,
                    ]),
                );
            }
        });
    }

    async deleteStorageMonitor(guildId: string, serverId: string, storageMonitorId: string): Promise<void> {
        await this.run(
            this.database(),
            'DELETE FROM storage_monitors WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
            [guildId, serverId, storageMonitorId],
        );
    }

    async setSmartSwitchGroupMessageId(
        guildId: string,
        serverId: string,
        groupId: string,
        messageId: string | null,
    ): Promise<void> {
        await this.run(
            this.database(),
            'UPDATE switch_groups SET message_id = ? WHERE guild_id = ? AND server_id = ? AND group_id = ?',
            [messageId, guildId, serverId, groupId],
        );
    }

    async updateSmartSwitchGroupFields(
        guildId: string,
        serverId: string,
        groupId: string,
        patch: SmartSwitchGroupPatch,
    ): Promise<void> {
        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['name', 'name'],
            ['active', 'active'],
            ['command', 'command'],
            ['image', 'image'],
        ] as const) {
            if (property in patch) {
                updates.push(`${column} = ?`);
                values.push(typeof patch[property] === 'boolean' ? dbBool(patch[property]) : patch[property]);
            }
        }
        if (updates.length === 0) return;
        await this.run(
            this.database(),
            `UPDATE switch_groups SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ? AND group_id = ?`,
            [...values, guildId, serverId, groupId],
        );
    }

    async upsertSmartSwitchGroup(
        guildId: string,
        serverId: string,
        groupId: string,
        switchGroup: SwitchGroup,
    ): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(
                client,
                `INSERT INTO switch_groups (guild_id, server_id, group_id, name, active, image, command, message_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, group_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    active = EXCLUDED.active,
                    image = EXCLUDED.image,
                    command = EXCLUDED.command,
                    message_id = EXCLUDED.message_id`,
                [
                    guildId,
                    serverId,
                    groupId,
                    switchGroup.name,
                    dbBool(switchGroup.active),
                    switchGroup.image,
                    switchGroup.command,
                    switchGroup.messageId,
                ],
            );
            await this.replaceSmartSwitchGroupSwitchesInTransaction(
                client,
                guildId,
                serverId,
                groupId,
                switchGroup.switches,
            );
        });
    }

    async deleteSmartSwitchGroup(guildId: string, serverId: string, groupId: string): Promise<void> {
        await this.run(
            this.database(),
            'DELETE FROM switch_groups WHERE guild_id = ? AND server_id = ? AND group_id = ?',
            [guildId, serverId, groupId],
        );
    }

    async replaceSmartSwitchGroupSwitches(
        guildId: string,
        serverId: string,
        groupId: string,
        switches: SwitchGroup['switches'],
    ): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.replaceSmartSwitchGroupSwitchesInTransaction(client, guildId, serverId, groupId, switches);
        });
    }

    async replaceServers(guildId: string, servers: Record<string, Server>): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM servers WHERE guild_id = ?', [guildId]);
            await this.writeServers(client, guildId, { serverList: servers } as Instance);
        });
    }

    private async replaceSmartSwitchGroupSwitchesInTransaction(
        client: PoolClient,
        guildId: string,
        serverId: string,
        groupId: string,
        switches: SwitchGroup['switches'],
    ): Promise<void> {
        await this.run(
            client,
            'DELETE FROM switch_group_members WHERE guild_id = ? AND server_id = ? AND group_id = ?',
            [guildId, serverId, groupId],
        );
        if (switches.length > 0) {
            await this.run(
                client,
                `INSERT INTO switch_group_members (guild_id, server_id, group_id, switch_id)
                VALUES ${switches.map(() => '(?, ?, ?, ?)').join(', ')}`,
                switches.flatMap((switchId) => [guildId, serverId, groupId, switchId]),
            );
        }
    }

    async readGuildCollections(guildId: string): Promise<GuildCollectionsState> {
        const instance = createEmptyInstance();
        await this.hydrateGuildCollections(guildId, instance);
        return {
            trackers: instance.trackers,
            marketSubscriptionList: instance.marketSubscriptionList,
            marketBlacklist: instance.marketBlacklist,
            teamChatColors: instance.teamChatColors,
            blacklist: instance.blacklist,
            whitelist: instance.whitelist,
            aliases: instance.aliases,
            customIntlMessages: instance.customIntlMessages,
        };
    }

    async upsertAlias(guildId: string, alias: Alias): Promise<void> {
        await this.run(
            this.database(),
            `INSERT INTO aliases (guild_id, alias_index, alias, value)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id, alias_index) DO UPDATE SET alias = EXCLUDED.alias, value = EXCLUDED.value`,
            [guildId, alias.index, alias.alias, alias.value],
        );
    }

    async deleteAlias(guildId: string, index: number): Promise<void> {
        await this.run(this.database(), 'DELETE FROM aliases WHERE guild_id = ? AND alias_index = ?', [guildId, index]);
    }

    async setCustomIntlMessage(guildId: string, key: string, message: string | null): Promise<void> {
        if (message === null) {
            await this.run(this.database(), 'DELETE FROM custom_intl_messages WHERE guild_id = ? AND message_key = ?', [
                guildId,
                key,
            ]);
            return;
        }
        await this.run(
            this.database(),
            `INSERT INTO custom_intl_messages (guild_id, message_key, message)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id, message_key) DO UPDATE SET message = EXCLUDED.message`,
            [guildId, key, message],
        );
    }

    async addBlacklistEntry(guildId: string, entryType: 'discord' | 'steam', entryId: string): Promise<void> {
        await this.run(
            this.database(),
            'INSERT INTO blacklist_entries (guild_id, entry_type, entry_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            [guildId, entryType, entryId],
        );
    }

    async removeBlacklistEntry(guildId: string, entryType: 'discord' | 'steam', entryId: string): Promise<void> {
        await this.run(
            this.database(),
            'DELETE FROM blacklist_entries WHERE guild_id = ? AND entry_type = ? AND entry_id = ?',
            [guildId, entryType, entryId],
        );
    }

    async addWhitelistSteamId(guildId: string, steamId: string): Promise<void> {
        await this.run(
            this.database(),
            'INSERT INTO whitelist_entries (guild_id, steam_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
            [guildId, steamId],
        );
    }

    async removeWhitelistSteamId(guildId: string, steamId: string): Promise<void> {
        await this.run(this.database(), 'DELETE FROM whitelist_entries WHERE guild_id = ? AND steam_id = ?', [
            guildId,
            steamId,
        ]);
    }

    async addMarketSubscription(guildId: string, listType: 'all' | 'buy' | 'sell', item: string): Promise<void> {
        await this.run(
            this.database(),
            'INSERT INTO market_subscriptions (guild_id, list_type, item) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            [guildId, listType, item],
        );
    }

    async removeMarketSubscription(guildId: string, listType: 'all' | 'buy' | 'sell', item: string): Promise<void> {
        await this.run(
            this.database(),
            'DELETE FROM market_subscriptions WHERE guild_id = ? AND list_type = ? AND item = ?',
            [guildId, listType, item],
        );
    }

    async addMarketBlacklistItem(guildId: string, item: string): Promise<void> {
        await this.run(
            this.database(),
            'INSERT INTO market_blacklist (guild_id, item) VALUES (?, ?) ON CONFLICT DO NOTHING',
            [guildId, item],
        );
    }

    async removeMarketBlacklistItem(guildId: string, item: string): Promise<void> {
        await this.run(this.database(), 'DELETE FROM market_blacklist WHERE guild_id = ? AND item = ?', [
            guildId,
            item,
        ]);
    }

    async setTeamChatColor(guildId: string, steamId: string, color: string): Promise<void> {
        await this.run(
            this.database(),
            `INSERT INTO team_chat_colors (guild_id, steam_id, color)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id, steam_id) DO UPDATE SET color = EXCLUDED.color`,
            [guildId, steamId, color],
        );
    }

    async replaceGuildCollections(guildId: string, collections: GuildCollectionsState): Promise<void> {
        await this.withTransaction(async (client) => {
            for (const table of [
                'trackers',
                'market_subscriptions',
                'market_blacklist',
                'blacklist_entries',
                'whitelist_entries',
                'aliases',
                'custom_intl_messages',
                'team_chat_colors',
            ]) {
                await this.run(client, `DELETE FROM ${table} WHERE guild_id = ?`, [guildId]);
            }
            await this.writeGuildCollections(client, guildId, collections as Instance);
        });
    }

    async deleteGuild(guildId: string): Promise<void> {
        await this.withTransaction((client) => this.run(client, 'DELETE FROM guilds WHERE guild_id = ?', [guildId]));
    }

    readCredentials(guildId: string): Promise<Credentials> {
        return this.readCredentialsFromDatabase(guildId);
    }

    async writeCredentials(guildId: string, credentials: Credentials): Promise<void> {
        await this.writeCredentialsAsync(guildId, credentials);
    }

    async bootstrapGuildState(guildId: string, instance: Instance): Promise<void> {
        await this.writeInstanceAsync(guildId, instance);
    }

    async flush(): Promise<void> {}

    private database(): Pool {
        if (!this.pool) throw new Error('Postgres persistence adapter has not been initialized');
        return this.pool;
    }

    private async patchGuildCore(client: PoolClient, guildId: string, base: Instance, next: Instance): Promise<void> {
        const coreUpdates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['firstTime', 'first_time'],
            ['role', 'role_id'],
            ['adminRole', 'admin_role_id'],
            ['activeServer', 'active_server_id'],
        ] as const) {
            if (!sameJson(base[property], next[property])) {
                coreUpdates.push(`${column} = ?`);
                values.push(property === 'firstTime' ? dbBool(next[property]) : next[property]);
            }
        }
        if (coreUpdates.length > 0) {
            await this.run(client, `UPDATE guilds SET ${coreUpdates.join(', ')} WHERE guild_id = ?`, [
                ...values,
                guildId,
            ]);
        }

        for (const [property, idKey] of CHANNEL_ID_KEYS) {
            if (!sameJson(base.channelId[property], next.channelId[property])) {
                await this.setDiscordId(client, guildId, idKey, next.channelId[property]);
            }
        }
        for (const [property, idKey] of INFORMATION_MESSAGE_ID_KEYS) {
            if (!sameJson(base.informationMessageId[property], next.informationMessageId[property])) {
                await this.setDiscordId(client, guildId, idKey, next.informationMessageId[property]);
            }
        }
    }

    private async patchGuildSettings(
        client: PoolClient,
        guildId: string,
        base: Instance,
        next: Instance,
    ): Promise<void> {
        for (const definition of PERSISTED_GUILD_SETTING_DEFINITIONS) {
            const baseValue = readGuildSettingValue(base, definition.key);
            const nextValue = readGuildSettingValue(next, definition.key);
            if (!sameJson(baseValue, nextValue)) {
                await this.run(
                    client,
                    `INSERT INTO guild_settings (guild_id, setting_key, setting_value)
                    VALUES (?, ?, ?)
                    ON CONFLICT(guild_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
                    [guildId, definition.key, serializeGuildSettingValue(definition, nextValue)],
                );
            }
        }
    }

    private async patchServers(client: PoolClient, guildId: string, base: Instance, next: Instance): Promise<void> {
        for (const serverId of unionKeys(base.serverList, next.serverList)) {
            const baseServer = base.serverList[serverId];
            const nextServer = next.serverList[serverId];
            if (!nextServer) {
                await this.run(client, 'DELETE FROM servers WHERE guild_id = ? AND server_id = ?', [guildId, serverId]);
                continue;
            }
            if (!baseServer) {
                await this.writeServers(client, guildId, { serverList: { [serverId]: nextServer } } as Instance);
                continue;
            }
            await this.patchServer(client, guildId, serverId, baseServer, nextServer);
        }
    }

    private async patchServer(
        client: PoolClient,
        guildId: string,
        serverId: string,
        base: Server,
        next: Server,
    ): Promise<void> {
        const updates: string[] = [];
        const values: unknown[] = [];
        for (const [property, column] of [
            ['title', 'title'],
            ['serverIp', 'server_ip'],
            ['appPort', 'app_port'],
            ['steamId', 'steam_id'],
            ['playerToken', 'player_token'],
            ['battlemetricsId', 'battlemetrics_id'],
            ['cargoShipEgressTimeMs', 'cargo_ship_egress_time_ms'],
            ['oilRigLockedCrateUnlockTimeMs', 'oil_rig_locked_crate_unlock_time_ms'],
            ['deepSeaMinWipeCooldownMs', 'deep_sea_min_wipe_cooldown_ms'],
            ['deepSeaMaxWipeCooldownMs', 'deep_sea_max_wipe_cooldown_ms'],
            ['deepSeaWipeDurationMs', 'deep_sea_wipe_duration_ms'],
            ['messageId', 'message_id'],
            ['connect', 'connect'],
            ['img', 'img'],
            ['url', 'url'],
            ['description', 'description'],
        ] as const) {
            if (!sameJson(base[property], next[property])) {
                updates.push(`${column} = ?`);
                values.push(next[property] ?? null);
            }
        }
        if (updates.length > 0) {
            await this.run(client, `UPDATE servers SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ?`, [
                ...values,
                guildId,
                serverId,
            ]);
        }

        if (!sameJson(base.timeTillDay, next.timeTillDay) || !sameJson(base.timeTillNight, next.timeTillNight)) {
            await this.run(client, 'DELETE FROM server_time_samples WHERE guild_id = ? AND server_id = ?', [
                guildId,
                serverId,
            ]);
            for (const [phase, samples] of [
                ['day', next.timeTillDay],
                ['night', next.timeTillNight],
            ] as const) {
                for (const [sampleKey, seconds] of Object.entries(samples ?? {})) {
                    await this.insert(
                        client,
                        'server_time_samples',
                        ['guild_id', 'server_id', 'phase', 'sample_key', 'seconds'],
                        [guildId, serverId, phase, sampleKey, seconds],
                    );
                }
            }
        }

        await this.patchSmartSwitches(client, guildId, serverId, base.switches ?? {}, next.switches ?? {});
        await this.patchSmartAlarms(client, guildId, serverId, base.alarms ?? {}, next.alarms ?? {});
        await this.patchStorageMonitors(
            client,
            guildId,
            serverId,
            base.storageMonitors ?? {},
            next.storageMonitors ?? {},
        );
        await this.patchSwitchGroups(client, guildId, serverId, base.switchGroups ?? {}, next.switchGroups ?? {});
        await this.patchCameraGroups(
            client,
            guildId,
            serverId,
            base.customCameraGroups ?? {},
            next.customCameraGroups ?? {},
        );
        await this.patchMarkers(client, guildId, serverId, base.markers ?? {}, next.markers ?? {});
        await this.patchNotes(client, guildId, serverId, base.notes ?? {}, next.notes ?? {});
    }

    private async patchSmartSwitches(
        client: PoolClient,
        guildId: string,
        serverId: string,
        base: Record<number, SmartSwitch>,
        next: Record<number, SmartSwitch>,
    ): Promise<void> {
        for (const switchId of unionKeys(base, next)) {
            const smartSwitch = next[switchId];
            if (!smartSwitch) {
                await this.run(
                    client,
                    'DELETE FROM smart_switches WHERE guild_id = ? AND server_id = ? AND switch_id = ?',
                    [guildId, serverId, switchId],
                );
            } else if (!sameJson(base[switchId], smartSwitch)) {
                await this.run(
                    client,
                    `INSERT INTO smart_switches (
                        guild_id, server_id, switch_id, name, active, reachable, location, x, y, image, command,
                        auto_day_night_on_off, proximity, message_id, everyone
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, switch_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        active = EXCLUDED.active,
                        reachable = EXCLUDED.reachable,
                        location = EXCLUDED.location,
                        x = EXCLUDED.x,
                        y = EXCLUDED.y,
                        image = EXCLUDED.image,
                        command = EXCLUDED.command,
                        auto_day_night_on_off = EXCLUDED.auto_day_night_on_off,
                        proximity = EXCLUDED.proximity,
                        message_id = EXCLUDED.message_id,
                        everyone = EXCLUDED.everyone`,
                    [
                        guildId,
                        serverId,
                        switchId,
                        smartSwitch.name,
                        dbBool(smartSwitch.active),
                        dbBool(smartSwitch.reachable),
                        smartSwitch.location,
                        smartSwitch.x,
                        smartSwitch.y,
                        smartSwitch.image,
                        smartSwitch.command,
                        smartSwitch.autoDayNightOnOff,
                        smartSwitch.proximity,
                        smartSwitch.messageId,
                        smartSwitch.everyone == null ? null : dbBool(smartSwitch.everyone),
                    ],
                );
            }
        }
    }

    private async patchSmartAlarms(
        client: PoolClient,
        guildId: string,
        serverId: string,
        base: Record<number, SmartAlarm>,
        next: Record<number, SmartAlarm>,
    ): Promise<void> {
        for (const alarmId of unionKeys(base, next)) {
            const alarm = next[alarmId];
            if (!alarm) {
                await this.run(
                    client,
                    'DELETE FROM smart_alarms WHERE guild_id = ? AND server_id = ? AND alarm_id = ?',
                    [guildId, serverId, alarmId],
                );
            } else if (!sameJson(base[alarmId], alarm)) {
                await this.run(
                    client,
                    `INSERT INTO smart_alarms (
                        guild_id, server_id, alarm_id, name, active, reachable, location, x, y, image, message, command,
                        last_trigger, in_game, message_id, everyone
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, alarm_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        active = EXCLUDED.active,
                        reachable = EXCLUDED.reachable,
                        location = EXCLUDED.location,
                        x = EXCLUDED.x,
                        y = EXCLUDED.y,
                        image = EXCLUDED.image,
                        message = EXCLUDED.message,
                        command = EXCLUDED.command,
                        last_trigger = EXCLUDED.last_trigger,
                        in_game = EXCLUDED.in_game,
                        message_id = EXCLUDED.message_id,
                        everyone = EXCLUDED.everyone`,
                    [
                        guildId,
                        serverId,
                        alarmId,
                        alarm.name,
                        dbBool(alarm.active),
                        dbBool(alarm.reachable),
                        alarm.location,
                        alarm.x,
                        alarm.y,
                        alarm.image,
                        alarm.message,
                        alarm.command,
                        alarm.lastTrigger,
                        dbBool(alarm.inGame),
                        alarm.messageId,
                        dbBool(alarm.everyone),
                    ],
                );
            }
        }
    }

    private async patchStorageMonitors(
        client: PoolClient,
        guildId: string,
        serverId: string,
        base: Record<number, StorageMonitor>,
        next: Record<number, StorageMonitor>,
    ): Promise<void> {
        for (const monitorId of unionKeys(base, next)) {
            const monitor = next[monitorId];
            if (!monitor) {
                await this.run(
                    client,
                    'DELETE FROM storage_monitors WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
                    [guildId, serverId, monitorId],
                );
                continue;
            }
            const baseWithoutItems = base[monitorId] ? { ...base[monitorId], items: [] } : undefined;
            const nextWithoutItems = { ...monitor, items: [] };
            if (!sameJson(baseWithoutItems, nextWithoutItems)) {
                await this.run(
                    client,
                    `INSERT INTO storage_monitors (
                        guild_id, server_id, storage_monitor_id, name, type, image, reachable, location, x, y, capacity,
                        decaying, in_game, message_id, everyone, upkeep
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, storage_monitor_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        type = EXCLUDED.type,
                        image = EXCLUDED.image,
                        reachable = EXCLUDED.reachable,
                        location = EXCLUDED.location,
                        x = EXCLUDED.x,
                        y = EXCLUDED.y,
                        capacity = EXCLUDED.capacity,
                        decaying = EXCLUDED.decaying,
                        in_game = EXCLUDED.in_game,
                        message_id = EXCLUDED.message_id,
                        everyone = EXCLUDED.everyone,
                        upkeep = EXCLUDED.upkeep`,
                    [
                        guildId,
                        serverId,
                        monitorId,
                        monitor.name,
                        monitor.type,
                        monitor.image,
                        dbBool(monitor.reachable),
                        monitor.location,
                        monitor.x,
                        monitor.y,
                        monitor.capacity,
                        monitor.decaying == null ? null : dbBool(monitor.decaying),
                        monitor.inGame == null ? null : dbBool(monitor.inGame),
                        monitor.messageId,
                        dbBool(monitor.everyone),
                        monitor.upkeep ?? null,
                    ],
                );
            }
            if (!sameJson(base[monitorId]?.items ?? [], monitor.items ?? [])) {
                await this.run(
                    client,
                    'DELETE FROM storage_monitor_items WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
                    [guildId, serverId, monitorId],
                );
                for (const item of monitor.items ?? []) {
                    await this.insert(
                        client,
                        'storage_monitor_items',
                        ['guild_id', 'server_id', 'storage_monitor_id', 'item_id', 'quantity'],
                        [guildId, serverId, monitorId, item.itemId, item.quantity],
                    );
                }
            }
        }
    }

    private async patchSwitchGroups(
        client: PoolClient,
        guildId: string,
        serverId: string,
        base: Record<number, SwitchGroup>,
        next: Record<number, SwitchGroup>,
    ): Promise<void> {
        for (const groupId of unionKeys(base, next)) {
            const group = next[groupId];
            if (!group) {
                await this.run(
                    client,
                    'DELETE FROM switch_groups WHERE guild_id = ? AND server_id = ? AND group_id = ?',
                    [guildId, serverId, groupId],
                );
                continue;
            }
            const baseWithoutMembers = base[groupId] ? { ...base[groupId], switches: [] } : undefined;
            const nextWithoutMembers = { ...group, switches: [] };
            if (!sameJson(baseWithoutMembers, nextWithoutMembers)) {
                await this.run(
                    client,
                    `INSERT INTO switch_groups (guild_id, server_id, group_id, name, active, image, command, message_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, group_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        active = EXCLUDED.active,
                        image = EXCLUDED.image,
                        command = EXCLUDED.command,
                        message_id = EXCLUDED.message_id`,
                    [
                        guildId,
                        serverId,
                        groupId,
                        group.name,
                        dbBool(group.active),
                        group.image,
                        group.command,
                        group.messageId,
                    ],
                );
            }
            if (!sameJson(base[groupId]?.switches ?? [], group.switches ?? [])) {
                await this.run(
                    client,
                    'DELETE FROM switch_group_members WHERE guild_id = ? AND server_id = ? AND group_id = ?',
                    [guildId, serverId, groupId],
                );
                for (const switchId of group.switches ?? []) {
                    await this.insert(
                        client,
                        'switch_group_members',
                        ['guild_id', 'server_id', 'group_id', 'switch_id'],
                        [guildId, serverId, groupId, switchId],
                    );
                }
            }
        }
    }

    private async patchCameraGroups(
        client: PoolClient,
        guildId: string,
        serverId: string,
        base: Server['customCameraGroups'],
        next: Server['customCameraGroups'],
    ): Promise<void> {
        for (const groupId of unionKeys(base, next)) {
            const group = next[groupId];
            if (!group) {
                await this.run(
                    client,
                    'DELETE FROM custom_camera_groups WHERE guild_id = ? AND server_id = ? AND group_id = ?',
                    [guildId, serverId, groupId],
                );
                continue;
            }
            if (!sameJson(base[groupId]?.name, group.name)) {
                await this.run(
                    client,
                    `INSERT INTO custom_camera_groups (guild_id, server_id, group_id, name)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, group_id) DO UPDATE SET name = EXCLUDED.name`,
                    [guildId, serverId, groupId, group.name],
                );
            }
            if (!sameJson(base[groupId]?.cameras ?? [], group.cameras ?? [])) {
                await this.run(
                    client,
                    'DELETE FROM custom_camera_group_members WHERE guild_id = ? AND server_id = ? AND group_id = ?',
                    [guildId, serverId, groupId],
                );
                for (const camera of group.cameras ?? []) {
                    await this.insert(
                        client,
                        'custom_camera_group_members',
                        ['guild_id', 'server_id', 'group_id', 'camera'],
                        [guildId, serverId, groupId, camera],
                    );
                }
            }
        }
    }

    private async patchMarkers(
        client: PoolClient,
        guildId: string,
        serverId: string,
        base: Record<string, Marker>,
        next: Record<string, Marker>,
    ): Promise<void> {
        for (const markerKey of unionKeys(base, next)) {
            const marker = next[markerKey];
            if (!marker) {
                await this.run(client, 'DELETE FROM markers WHERE guild_id = ? AND server_id = ? AND marker_key = ?', [
                    guildId,
                    serverId,
                    markerKey,
                ]);
            } else if (!sameJson(base[markerKey], marker)) {
                await this.run(
                    client,
                    `INSERT INTO markers (guild_id, server_id, marker_key, x, y, location)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, marker_key) DO UPDATE SET
                        x = EXCLUDED.x,
                        y = EXCLUDED.y,
                        location = EXCLUDED.location`,
                    [guildId, serverId, markerKey, marker.x, marker.y, marker.location],
                );
            }
        }
    }

    private async patchNotes(
        client: PoolClient,
        guildId: string,
        serverId: string,
        base: Record<number, string>,
        next: Record<number, string>,
    ): Promise<void> {
        for (const noteId of unionKeys(base, next)) {
            const note = next[noteId];
            if (note == null) {
                await this.run(client, 'DELETE FROM notes WHERE guild_id = ? AND server_id = ? AND note_id = ?', [
                    guildId,
                    serverId,
                    noteId,
                ]);
            } else if (!sameJson(base[noteId], note)) {
                await this.run(
                    client,
                    `INSERT INTO notes (guild_id, server_id, note_id, note)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, note_id) DO UPDATE SET note = EXCLUDED.note`,
                    [guildId, serverId, noteId, note],
                );
            }
        }
    }

    private async patchGuildCollections(
        client: PoolClient,
        guildId: string,
        base: Instance,
        next: Instance,
    ): Promise<void> {
        await this.patchTrackers(client, guildId, base.trackers ?? {}, next.trackers ?? {});
        await this.patchMarketSubscriptions(
            client,
            guildId,
            'all',
            base.marketSubscriptionList.all,
            next.marketSubscriptionList.all,
        );
        await this.patchMarketSubscriptions(
            client,
            guildId,
            'buy',
            base.marketSubscriptionList.buy,
            next.marketSubscriptionList.buy,
        );
        await this.patchMarketSubscriptions(
            client,
            guildId,
            'sell',
            base.marketSubscriptionList.sell,
            next.marketSubscriptionList.sell,
        );
        await this.patchStringSet(
            client,
            guildId,
            'market_blacklist',
            'item',
            base.marketBlacklist,
            next.marketBlacklist,
        );
        await this.patchBlacklist(client, guildId, 'discord', base.blacklist.discordIds, next.blacklist.discordIds);
        await this.patchBlacklist(client, guildId, 'steam', base.blacklist.steamIds, next.blacklist.steamIds);
        await this.patchStringSet(
            client,
            guildId,
            'whitelist_entries',
            'steam_id',
            base.whitelist.steamIds,
            next.whitelist.steamIds,
        );
        await this.patchAliases(client, guildId, base.aliases ?? [], next.aliases ?? []);
        await this.patchKeyValueCollection(
            client,
            guildId,
            'custom_intl_messages',
            'message_key',
            'message',
            base.customIntlMessages ?? {},
            next.customIntlMessages ?? {},
        );
        await this.patchKeyValueCollection(
            client,
            guildId,
            'team_chat_colors',
            'steam_id',
            'color',
            base.teamChatColors ?? {},
            next.teamChatColors ?? {},
        );
    }

    private async patchTrackers(
        client: PoolClient,
        guildId: string,
        base: Record<string, Tracker>,
        next: Record<string, Tracker>,
    ): Promise<void> {
        for (const trackerId of unionKeys(base, next)) {
            const tracker = next[trackerId];
            if (!tracker) {
                await this.run(client, 'DELETE FROM trackers WHERE guild_id = ? AND tracker_id = ?', [
                    guildId,
                    trackerId,
                ]);
                continue;
            }
            const normalized = normalizeTracker(trackerId, tracker);
            const baseWithoutPlayers = base[trackerId]
                ? { ...normalizeTracker(trackerId, base[trackerId]), players: [] }
                : undefined;
            const nextWithoutPlayers = { ...normalized, players: [] };
            if (!sameJson(baseWithoutPlayers, nextWithoutPlayers)) {
                await this.run(
                    client,
                    `INSERT INTO trackers (
                        guild_id, tracker_id, id, name, battlemetrics_id, status, last_screenshot, last_online,
                        last_wipe, message_id, clan_tag, everyone, in_game, img, title, server_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, tracker_id) DO UPDATE SET
                        id = EXCLUDED.id,
                        name = EXCLUDED.name,
                        battlemetrics_id = EXCLUDED.battlemetrics_id,
                        status = EXCLUDED.status,
                        last_screenshot = EXCLUDED.last_screenshot,
                        last_online = EXCLUDED.last_online,
                        last_wipe = EXCLUDED.last_wipe,
                        message_id = EXCLUDED.message_id,
                        clan_tag = EXCLUDED.clan_tag,
                        everyone = EXCLUDED.everyone,
                        in_game = EXCLUDED.in_game,
                        img = EXCLUDED.img,
                        title = EXCLUDED.title,
                        server_id = EXCLUDED.server_id`,
                    [
                        guildId,
                        trackerId,
                        normalized.id,
                        normalized.name,
                        normalized.battlemetricsId,
                        dbBool(normalized.status),
                        normalized.lastScreenshot,
                        normalized.lastOnline,
                        normalized.lastWipe,
                        normalized.messageId,
                        normalized.clanTag,
                        dbBool(normalized.everyone),
                        dbBool(normalized.inGame),
                        normalized.img ?? null,
                        normalized.title ?? null,
                        normalized.serverId ?? null,
                    ],
                );
            }
            if (!sameJson(base[trackerId]?.players ?? [], normalized.players ?? [])) {
                await this.run(client, 'DELETE FROM tracker_players WHERE guild_id = ? AND tracker_id = ?', [
                    guildId,
                    trackerId,
                ]);
                for (const [index, player] of normalized.players.entries()) {
                    await this.insert(
                        client,
                        'tracker_players',
                        ['guild_id', 'tracker_id', 'player_index', 'name', 'steam_id', 'player_id'],
                        [guildId, trackerId, index, player.name ?? null, player.steamId, player.playerId],
                    );
                }
            }
        }
    }

    private async patchMarketSubscriptions(
        client: PoolClient,
        guildId: string,
        listType: 'all' | 'buy' | 'sell',
        baseItems: string[],
        nextItems: string[],
    ): Promise<void> {
        for (const item of difference(baseItems, nextItems)) {
            await this.run(
                client,
                'DELETE FROM market_subscriptions WHERE guild_id = ? AND list_type = ? AND item = ?',
                [guildId, listType, item],
            );
        }
        for (const item of difference(nextItems, baseItems)) {
            await this.run(
                client,
                'INSERT INTO market_subscriptions (guild_id, list_type, item) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
                [guildId, listType, item],
            );
        }
    }

    private async patchBlacklist(
        client: PoolClient,
        guildId: string,
        entryType: 'discord' | 'steam',
        baseItems: string[],
        nextItems: string[],
    ): Promise<void> {
        for (const entryId of difference(baseItems, nextItems)) {
            await this.run(
                client,
                'DELETE FROM blacklist_entries WHERE guild_id = ? AND entry_type = ? AND entry_id = ?',
                [guildId, entryType, entryId],
            );
        }
        for (const entryId of difference(nextItems, baseItems)) {
            await this.run(
                client,
                'INSERT INTO blacklist_entries (guild_id, entry_type, entry_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
                [guildId, entryType, entryId],
            );
        }
    }

    private async patchStringSet(
        client: PoolClient,
        guildId: string,
        table: 'market_blacklist' | 'whitelist_entries',
        column: 'item' | 'steam_id',
        baseItems: string[],
        nextItems: string[],
    ): Promise<void> {
        for (const item of difference(baseItems, nextItems)) {
            await this.run(client, `DELETE FROM ${table} WHERE guild_id = ? AND ${column} = ?`, [guildId, item]);
        }
        for (const item of difference(nextItems, baseItems)) {
            await this.run(client, `INSERT INTO ${table} (guild_id, ${column}) VALUES (?, ?) ON CONFLICT DO NOTHING`, [
                guildId,
                item,
            ]);
        }
    }

    private async patchAliases(
        client: PoolClient,
        guildId: string,
        baseAliases: Alias[],
        nextAliases: Alias[],
    ): Promise<void> {
        const baseByIndex = new Map(baseAliases.map((alias) => [alias.index, alias]));
        const nextByIndex = new Map(nextAliases.map((alias) => [alias.index, alias]));
        for (const index of new Set([...baseByIndex.keys(), ...nextByIndex.keys()])) {
            const nextAlias = nextByIndex.get(index);
            if (!nextAlias) {
                await this.run(client, 'DELETE FROM aliases WHERE guild_id = ? AND alias_index = ?', [guildId, index]);
            } else if (!sameJson(baseByIndex.get(index), nextAlias)) {
                await this.run(
                    client,
                    `INSERT INTO aliases (guild_id, alias_index, alias, value)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(guild_id, alias_index) DO UPDATE SET
                        alias = EXCLUDED.alias,
                        value = EXCLUDED.value`,
                    [guildId, nextAlias.index, nextAlias.alias, nextAlias.value],
                );
            }
        }
    }

    private async patchKeyValueCollection(
        client: PoolClient,
        guildId: string,
        table: 'custom_intl_messages' | 'team_chat_colors',
        keyColumn: 'message_key' | 'steam_id',
        valueColumn: 'message' | 'color',
        base: Record<string, string>,
        next: Record<string, string>,
    ): Promise<void> {
        for (const key of unionKeys(base, next)) {
            const value = next[key];
            if (value == null) {
                await this.run(client, `DELETE FROM ${table} WHERE guild_id = ? AND ${keyColumn} = ?`, [guildId, key]);
            } else if (!sameJson(base[key], value)) {
                await this.run(
                    client,
                    `INSERT INTO ${table} (guild_id, ${keyColumn}, ${valueColumn})
                    VALUES (?, ?, ?)
                    ON CONFLICT(guild_id, ${keyColumn}) DO UPDATE SET ${valueColumn} = EXCLUDED.${valueColumn}`,
                    [guildId, key, value],
                );
            }
        }
    }

    private async setDiscordId(
        client: PoolClient,
        guildId: string,
        idKey: string,
        value: string | null,
    ): Promise<void> {
        if (value) {
            await this.run(
                client,
                `INSERT INTO guild_discord_ids (guild_id, id_key, id_value)
                VALUES (?, ?, ?)
                ON CONFLICT(guild_id, id_key) DO UPDATE SET id_value = EXCLUDED.id_value`,
                [guildId, idKey, value],
            );
        } else {
            await this.run(client, 'DELETE FROM guild_discord_ids WHERE guild_id = ? AND id_key = ?', [guildId, idKey]);
        }
    }

    private async validateMigrated(): Promise<void> {
        try {
            const schemaVersion = (
                await this.database().query("SELECT value FROM _persistence_meta WHERE key = 'schema_version'")
            ).rows[0]?.value;
            if (schemaVersion !== '1') {
                throw new Error(`expected schema_version=1, got ${schemaVersion ?? 'missing'}`);
            }
        } catch (error) {
            throw new Error(
                `Postgres persistence schema is missing or incomplete. Run dbmate before starting the bot. ${error}`,
            );
        }
    }

    private async migrateLegacyJson(): Promise<void> {
        const status = (
            await this.rows("SELECT value FROM _persistence_meta WHERE key = 'legacy_json_migration_status'")
        )[0]?.value;
        const source = new JsonAdapter();
        const manifest = source.sourceManifest();
        if (status === 'completed') {
            const migratedGuildCount = await this.readMetaValue('legacy_json_migration_source_guild_count');
            const migratedChecksum = await this.readMetaValue('legacy_json_migration_source_checksum');
            persistenceLogger.info(
                `[persistence] Legacy JSON migration already completed for Postgres; skipping. ` +
                    `Recorded source guilds=${migratedGuildCount ?? 'unknown'}, ` +
                    `recorded checksum=${migratedChecksum ?? 'unknown'}, current source guilds=${manifest.guildCount}, ` +
                    `current checksum=${manifest.checksum}.`,
            );
            if (migratedChecksum && migratedChecksum !== manifest.checksum) {
                persistenceLogger.warn(
                    '[persistence] Legacy JSON source files differ from the completed migration checksum. ' +
                        'The migration will not be re-run automatically; inspect the target database and legacy JSON files manually.',
                );
            }
            return;
        }
        if (status === 'in_progress') {
            throw new Error(
                'Legacy JSON migration is marked in_progress. Inspect persistence state before restarting.',
            );
        }
        if (status) {
            persistenceLogger.warn(
                `[persistence] Legacy JSON migration has unexpected Postgres status '${status}'. ` +
                    'The adapter will attempt a new migration and overwrite that status.',
            );
        }

        persistenceLogger.info(
            `[persistence] Starting one-time legacy JSON to Postgres migration. ` +
                `Target state key: _persistence_meta.legacy_json_migration_status. ` +
                `Source guilds=${manifest.guildCount}, source checksum=${manifest.checksum}.`,
        );
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_status', 'in_progress', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
        );
        let migratedManifest: { guildCount: number; checksum: string };
        try {
            migratedManifest = await migrateFromJsonAdapter(source, this, persistenceLogger);
        } catch (error) {
            persistenceLogger.error(
                `[persistence] Legacy JSON to Postgres migration failed while status is in_progress. ` +
                    `The next startup will stop until _persistence_meta is inspected. Error: ${error}`,
            );
            throw error;
        }
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_status', 'completed', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
        );
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_source_guild_count', ?, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
            [String(migratedManifest.guildCount)],
        );
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_source_checksum', ?, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
            [migratedManifest.checksum],
        );
        persistenceLogger.info(
            `[persistence] Completed legacy JSON to Postgres migration. ` +
                `Migrated guilds=${migratedManifest.guildCount}, source checksum=${migratedManifest.checksum}. ` +
                'Future startups will skip this migration because legacy_json_migration_status=completed.',
        );
    }

    private async readMetaValue(key: string): Promise<string | null> {
        return (await this.rows('SELECT value FROM _persistence_meta WHERE key = ?', [key]))[0]?.value ?? null;
    }

    private async writeInstanceAsync(guildId: string, instance: Instance): Promise<void> {
        const existingCredentials = await this.readCredentialsFromDatabase(guildId);
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM guilds WHERE guild_id = ?', [guildId]);
            await this.writeGuild(client, guildId, instance);
            await this.writeSettings(client, guildId, instance);
            await this.writeServers(client, guildId, instance);
            await this.writeServerLiteEntries(client, guildId, instance);
            await this.writeGuildCollections(client, guildId, instance);
            await this.writeCredentialsRows(client, guildId, existingCredentials);
        });
    }

    private async writeCredentialsAsync(guildId: string, credentials: Credentials): Promise<void> {
        await this.withTransaction((client) => this.writeCredentialsRows(client, guildId, credentials));
    }

    private async readInstanceFromDatabase(guildId: string): Promise<Instance> {
        const guild = (await this.rows('SELECT * FROM guilds WHERE guild_id = ?', [guildId]))[0];
        if (!guild) throw new Error(`No persisted guild state found for ${guildId}`);

        const instance = createEmptyInstance();
        instance.firstTime = fromDbBool(guild.first_time);
        instance.role = guild.role_id;
        instance.adminRole = guild.admin_role_id;
        instance.activeServer = guild.active_server_id;
        instance.channelId = await this.readChannelIds(guildId);
        instance.informationMessageId = await this.readInformationMessageIds(guildId);

        await this.readSettings(guildId, instance);
        await this.hydrateServers(guildId, instance);
        await this.hydrateGuildCollections(guildId, instance);
        return instance;
    }

    private async readCredentialsFromDatabase(guildId: string): Promise<Credentials> {
        const credentials: Credentials = {
            hoster:
                (await this.rows('SELECT steam_id FROM credentials_hoster WHERE guild_id = ?', [guildId]))[0]
                    ?.steam_id ?? null,
        };
        for (const row of await this.rows('SELECT * FROM fcm_credentials WHERE guild_id = ?', [guildId])) {
            (credentials as unknown as Record<string, unknown>)[row.steam_id] = {
                discord_user_id: row.discord_user_id,
                gcm: {
                    android_id: row.gcm_android_id,
                    security_token: row.gcm_security_token,
                },
                issuedDate: row.issued_date,
                expireDate: row.expire_date,
            };
        }
        return credentials;
    }

    private async writeCredentialsRows(
        client: Pool | PoolClient,
        guildId: string,
        credentials: Credentials,
    ): Promise<void> {
        await this.run(client, 'DELETE FROM fcm_credentials WHERE guild_id = ?', [guildId]);
        await this.run(client, 'DELETE FROM credentials_hoster WHERE guild_id = ?', [guildId]);
        await this.run(client, 'INSERT INTO credentials_hoster (guild_id, steam_id) VALUES (?, ?)', [
            guildId,
            credentials.hoster ?? null,
        ]);
        for (const [steamId, credential] of credentialEntries(credentials)) {
            await this.run(
                client,
                `INSERT INTO fcm_credentials (
                    guild_id, steam_id, discord_user_id, gcm_android_id, gcm_security_token, issued_date, expire_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    guildId,
                    steamId,
                    credential.discord_user_id ?? '',
                    (credential.gcm as Row | undefined)?.android_id ?? credential.gcm_android_id ?? '',
                    (credential.gcm as Row | undefined)?.security_token ?? credential.gcm_security_token ?? '',
                    credential.issuedDate ?? credential.issued_date ?? null,
                    credential.expireDate ?? credential.expire_date ?? null,
                ],
            );
        }
    }

    private async writeGuild(client: PoolClient, guildId: string, instance: GuildCoreState): Promise<void> {
        await this.run(
            client,
            `INSERT INTO guilds (guild_id, first_time, role_id, admin_role_id, active_server_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (guild_id) DO UPDATE SET
                first_time = EXCLUDED.first_time,
                role_id = EXCLUDED.role_id,
                admin_role_id = EXCLUDED.admin_role_id,
                active_server_id = EXCLUDED.active_server_id`,
            [guildId, dbBool(instance.firstTime), instance.role, instance.adminRole, instance.activeServer],
        );
        await this.run(client, 'DELETE FROM guild_discord_ids WHERE guild_id = ?', [guildId]);
        for (const [property, idKey] of CHANNEL_ID_KEYS) {
            const value = instance.channelId[property];
            if (value)
                await this.insert(
                    client,
                    'guild_discord_ids',
                    ['guild_id', 'id_key', 'id_value'],
                    [guildId, idKey, value],
                );
        }
        for (const [property, idKey] of INFORMATION_MESSAGE_ID_KEYS) {
            const value = instance.informationMessageId[property];
            if (value)
                await this.insert(
                    client,
                    'guild_discord_ids',
                    ['guild_id', 'id_key', 'id_value'],
                    [guildId, idKey, value],
                );
        }
    }

    private async writeSettings(client: PoolClient, guildId: string, instance: GuildSettingsState): Promise<void> {
        for (const definition of PERSISTED_GUILD_SETTING_DEFINITIONS) {
            const value = readGuildSettingValue(instance, definition.key);
            await this.insert(
                client,
                'guild_settings',
                ['guild_id', 'setting_key', 'setting_value'],
                [guildId, definition.key, serializeGuildSettingValue(definition, value)],
            );
        }
    }

    private async readSettings(guildId: string, instance: Instance): Promise<void> {
        instance.generalSettings = buildDefaultGeneralSettings();
        instance.notificationSettings = buildDefaultNotificationSettings();
        for (const row of await this.rows('SELECT setting_key, setting_value FROM guild_settings WHERE guild_id = ?', [
            guildId,
        ])) {
            applyPersistedGuildSetting(instance, row.setting_key, row.setting_value);
        }
    }

    private async readChannelIds(guildId: string): Promise<GuildCoreState['channelId']> {
        const channelId = createEmptyInstance().channelId;
        const rows = await this.rows(
            "SELECT id_key, id_value FROM guild_discord_ids WHERE guild_id = ? AND id_key LIKE 'channel.%'",
            [guildId],
        );
        const rowsByKey = new Map(rows.map((row) => [row.id_key, row.id_value]));
        for (const [property, idKey] of CHANNEL_ID_KEYS) {
            channelId[property] = rowsByKey.get(idKey) ?? null;
        }
        return channelId;
    }

    private async readInformationMessageIds(guildId: string): Promise<GuildCoreState['informationMessageId']> {
        const informationMessageId = createEmptyInstance().informationMessageId;
        const rows = await this.rows(
            "SELECT id_key, id_value FROM guild_discord_ids WHERE guild_id = ? AND id_key LIKE 'informationMessage.%'",
            [guildId],
        );
        const rowsByKey = new Map(rows.map((row) => [row.id_key, row.id_value]));
        for (const [property, idKey] of INFORMATION_MESSAGE_ID_KEYS) {
            informationMessageId[property] = rowsByKey.get(idKey) ?? null;
        }
        return informationMessageId;
    }

    private async writeServers(client: PoolClient, guildId: string, instance: Instance): Promise<void> {
        for (const [serverId, server] of Object.entries(instance.serverList)) {
            await this.insert(
                client,
                'servers',
                [
                    'guild_id',
                    'server_id',
                    'title',
                    'server_ip',
                    'app_port',
                    'steam_id',
                    'player_token',
                    'battlemetrics_id',
                    'cargo_ship_egress_time_ms',
                    'oil_rig_locked_crate_unlock_time_ms',
                    'deep_sea_min_wipe_cooldown_ms',
                    'deep_sea_max_wipe_cooldown_ms',
                    'deep_sea_wipe_duration_ms',
                    'message_id',
                    'connect',
                    'img',
                    'url',
                    'description',
                ],
                [
                    guildId,
                    serverId,
                    server.title,
                    server.serverIp,
                    server.appPort,
                    server.steamId,
                    server.playerToken,
                    server.battlemetricsId,
                    server.cargoShipEgressTimeMs,
                    server.oilRigLockedCrateUnlockTimeMs,
                    server.deepSeaMinWipeCooldownMs,
                    server.deepSeaMaxWipeCooldownMs,
                    server.deepSeaWipeDurationMs,
                    server.messageId,
                    server.connect ?? null,
                    server.img ?? null,
                    server.url ?? null,
                    server.description ?? null,
                ],
            );

            for (const [phase, samples] of [
                ['day', server.timeTillDay],
                ['night', server.timeTillNight],
            ] as const) {
                for (const [sampleKey, seconds] of Object.entries(samples ?? {})) {
                    await this.insert(
                        client,
                        'server_time_samples',
                        ['guild_id', 'server_id', 'phase', 'sample_key', 'seconds'],
                        [guildId, serverId, phase, sampleKey, seconds],
                    );
                }
            }

            for (const [switchId, smartSwitch] of Object.entries(server.switches ?? {})) {
                await this.insert(
                    client,
                    'smart_switches',
                    [
                        'guild_id',
                        'server_id',
                        'switch_id',
                        'name',
                        'active',
                        'reachable',
                        'location',
                        'x',
                        'y',
                        'image',
                        'command',
                        'auto_day_night_on_off',
                        'proximity',
                        'message_id',
                        'everyone',
                    ],
                    [
                        guildId,
                        serverId,
                        switchId,
                        smartSwitch.name,
                        dbBool(smartSwitch.active),
                        dbBool(smartSwitch.reachable),
                        smartSwitch.location,
                        smartSwitch.x,
                        smartSwitch.y,
                        smartSwitch.image,
                        smartSwitch.command,
                        smartSwitch.autoDayNightOnOff,
                        smartSwitch.proximity,
                        smartSwitch.messageId,
                        smartSwitch.everyone == null ? null : dbBool(smartSwitch.everyone),
                    ],
                );
            }

            for (const [alarmId, alarm] of Object.entries(server.alarms ?? {})) {
                await this.insert(
                    client,
                    'smart_alarms',
                    [
                        'guild_id',
                        'server_id',
                        'alarm_id',
                        'name',
                        'active',
                        'reachable',
                        'location',
                        'x',
                        'y',
                        'image',
                        'message',
                        'command',
                        'last_trigger',
                        'in_game',
                        'message_id',
                        'everyone',
                    ],
                    [
                        guildId,
                        serverId,
                        alarmId,
                        alarm.name,
                        dbBool(alarm.active),
                        dbBool(alarm.reachable),
                        alarm.location,
                        alarm.x,
                        alarm.y,
                        alarm.image,
                        alarm.message,
                        alarm.command,
                        alarm.lastTrigger,
                        dbBool(alarm.inGame),
                        alarm.messageId,
                        dbBool(alarm.everyone),
                    ],
                );
            }

            for (const [monitorId, monitor] of Object.entries(server.storageMonitors ?? {})) {
                await this.insert(
                    client,
                    'storage_monitors',
                    [
                        'guild_id',
                        'server_id',
                        'storage_monitor_id',
                        'name',
                        'type',
                        'image',
                        'reachable',
                        'location',
                        'x',
                        'y',
                        'capacity',
                        'decaying',
                        'in_game',
                        'message_id',
                        'everyone',
                        'upkeep',
                    ],
                    [
                        guildId,
                        serverId,
                        monitorId,
                        monitor.name,
                        monitor.type,
                        monitor.image,
                        dbBool(monitor.reachable),
                        monitor.location,
                        monitor.x,
                        monitor.y,
                        monitor.capacity,
                        monitor.decaying == null ? null : dbBool(monitor.decaying),
                        monitor.inGame == null ? null : dbBool(monitor.inGame),
                        monitor.messageId,
                        dbBool(monitor.everyone),
                        monitor.upkeep ?? null,
                    ],
                );
                for (const item of monitor.items ?? []) {
                    await this.insert(
                        client,
                        'storage_monitor_items',
                        ['guild_id', 'server_id', 'storage_monitor_id', 'item_id', 'quantity'],
                        [guildId, serverId, monitorId, item.itemId, item.quantity],
                    );
                }
            }

            for (const [groupId, group] of Object.entries(server.switchGroups ?? {})) {
                await this.insert(
                    client,
                    'switch_groups',
                    ['guild_id', 'server_id', 'group_id', 'name', 'active', 'image', 'command', 'message_id'],
                    [
                        guildId,
                        serverId,
                        groupId,
                        group.name,
                        dbBool(group.active),
                        group.image,
                        group.command,
                        group.messageId,
                    ],
                );
                for (const switchId of group.switches ?? []) {
                    await this.insert(
                        client,
                        'switch_group_members',
                        ['guild_id', 'server_id', 'group_id', 'switch_id'],
                        [guildId, serverId, groupId, switchId],
                    );
                }
            }

            for (const [groupId, group] of Object.entries(server.customCameraGroups ?? {})) {
                await this.insert(
                    client,
                    'custom_camera_groups',
                    ['guild_id', 'server_id', 'group_id', 'name'],
                    [guildId, serverId, groupId, group.name],
                );
                for (const camera of group.cameras ?? []) {
                    await this.insert(
                        client,
                        'custom_camera_group_members',
                        ['guild_id', 'server_id', 'group_id', 'camera'],
                        [guildId, serverId, groupId, camera],
                    );
                }
            }

            for (const [markerKey, marker] of Object.entries(server.markers ?? {})) {
                await this.insert(
                    client,
                    'markers',
                    ['guild_id', 'server_id', 'marker_key', 'x', 'y', 'location'],
                    [guildId, serverId, markerKey, marker.x, marker.y, marker.location],
                );
            }

            for (const [noteId, note] of Object.entries(server.notes ?? {})) {
                await this.insert(
                    client,
                    'notes',
                    ['guild_id', 'server_id', 'note_id', 'note'],
                    [guildId, serverId, noteId, note],
                );
            }
        }
    }

    private async writeServerLiteEntries(client: PoolClient, guildId: string, instance: Instance): Promise<void> {
        for (const [serverId, entries] of Object.entries(instance.serverListLite ?? {})) {
            for (const [steamId, entry] of Object.entries(entries ?? {})) {
                await this.run(
                    client,
                    `INSERT INTO server_lite_entries (guild_id, server_id, steam_id, server_ip, app_port, player_token)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, steam_id) DO UPDATE SET
                        server_ip = EXCLUDED.server_ip,
                        app_port = EXCLUDED.app_port,
                        player_token = EXCLUDED.player_token`,
                    [guildId, serverId, steamId, entry.serverIp, entry.appPort, entry.playerToken],
                );
            }
        }
    }

    private async hydrateServers(guildId: string, instance: Instance): Promise<void> {
        for (const row of await this.rows('SELECT * FROM servers WHERE guild_id = ?', [guildId])) {
            const server: Server = {
                serverId: row.server_id,
                title: row.title,
                serverIp: row.server_ip,
                appPort: row.app_port,
                steamId: row.steam_id,
                playerToken: row.player_token,
                battlemetricsId: row.battlemetrics_id,
                switches: {},
                alarms: {},
                storageMonitors: {},
                markers: {},
                switchGroups: {},
                customCameraGroups: {},
                notes: {},
                cargoShipEgressTimeMs: row.cargo_ship_egress_time_ms,
                oilRigLockedCrateUnlockTimeMs: row.oil_rig_locked_crate_unlock_time_ms,
                deepSeaMinWipeCooldownMs: row.deep_sea_min_wipe_cooldown_ms,
                deepSeaMaxWipeCooldownMs: row.deep_sea_max_wipe_cooldown_ms,
                deepSeaWipeDurationMs: row.deep_sea_wipe_duration_ms,
                timeTillDay: null,
                timeTillNight: null,
                messageId: row.message_id,
                connect: row.connect,
                img: row.img,
                url: row.url,
                description: row.description,
            };
            instance.serverList[server.serverId] = server;
            addServerLite(instance, server);
        }

        for (const row of await this.rows('SELECT * FROM server_time_samples WHERE guild_id = ?', [guildId])) {
            const server = instance.serverList[row.server_id];
            if (!server) continue;
            const target = row.phase === 'day' ? 'timeTillDay' : 'timeTillNight';
            server[target] ??= {};
            server[target][row.sample_key] = Number(row.seconds);
        }

        for (const row of await this.rows('SELECT * FROM smart_switches WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].switches[row.switch_id] = {
                id: row.switch_id,
                name: row.name,
                active: fromDbBool(row.active),
                reachable: fromDbBool(row.reachable),
                location: row.location,
                x: row.x,
                y: row.y,
                image: row.image,
                command: row.command,
                autoDayNightOnOff: row.auto_day_night_on_off,
                proximity: row.proximity,
                messageId: row.message_id,
                everyone: row.everyone == null ? undefined : fromDbBool(row.everyone),
                serverId: row.server_id,
            };
        }

        for (const row of await this.rows('SELECT * FROM smart_alarms WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].alarms[row.alarm_id] = {
                id: row.alarm_id,
                name: row.name,
                active: fromDbBool(row.active),
                reachable: fromDbBool(row.reachable),
                location: row.location,
                x: row.x,
                y: row.y,
                image: row.image,
                message: row.message,
                command: row.command,
                lastTrigger: row.last_trigger,
                inGame: fromDbBool(row.in_game),
                messageId: row.message_id,
                everyone: fromDbBool(row.everyone),
                server: row.server_id,
            };
        }

        for (const row of await this.rows('SELECT * FROM storage_monitors WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].storageMonitors[row.storage_monitor_id] = {
                id: row.storage_monitor_id,
                name: row.name,
                type: row.type,
                image: row.image,
                reachable: fromDbBool(row.reachable),
                location: row.location,
                x: row.x,
                y: row.y,
                items: [],
                capacity: row.capacity,
                decaying: row.decaying == null ? null : fromDbBool(row.decaying),
                inGame: row.in_game == null ? null : fromDbBool(row.in_game),
                messageId: row.message_id,
                everyone: fromDbBool(row.everyone),
                server: row.server_id,
                upkeep: row.upkeep,
            };
        }

        for (const row of await this.rows('SELECT * FROM storage_monitor_items WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].storageMonitors[row.storage_monitor_id].items.push({
                itemId: row.item_id,
                quantity: row.quantity,
            });
        }

        for (const row of await this.rows('SELECT * FROM switch_groups WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].switchGroups[row.group_id] = {
                id: row.group_id,
                name: row.name,
                switches: [],
                active: fromDbBool(row.active),
                image: row.image,
                command: row.command,
                serverId: row.server_id,
                messageId: row.message_id,
            };
        }

        for (const row of await this.rows('SELECT * FROM switch_group_members WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].switchGroups[row.group_id].switches.push(row.switch_id);
        }

        for (const row of await this.rows('SELECT * FROM custom_camera_groups WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].customCameraGroups[row.group_id] = {
                id: row.group_id,
                name: row.name,
                cameras: [],
            };
        }

        for (const row of await this.rows('SELECT * FROM custom_camera_group_members WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].customCameraGroups[row.group_id].cameras.push(row.camera);
        }

        for (const row of await this.rows('SELECT * FROM markers WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].markers[row.marker_key] = {
                x: row.x,
                y: row.y,
                location: row.location,
            };
        }

        for (const row of await this.rows('SELECT * FROM notes WHERE guild_id = ?', [guildId])) {
            instance.serverList[row.server_id].notes[row.note_id] = row.note;
        }
    }

    private async writeGuildCollections(client: PoolClient, guildId: string, instance: Instance): Promise<void> {
        for (const [trackerKey, tracker] of Object.entries(instance.trackers)) {
            const normalized = normalizeTracker(trackerKey, tracker);
            await this.insert(
                client,
                'trackers',
                [
                    'guild_id',
                    'tracker_id',
                    'id',
                    'name',
                    'battlemetrics_id',
                    'status',
                    'last_screenshot',
                    'last_online',
                    'last_wipe',
                    'message_id',
                    'clan_tag',
                    'everyone',
                    'in_game',
                    'img',
                    'title',
                    'server_id',
                ],
                [
                    guildId,
                    trackerKey,
                    normalized.id,
                    normalized.name,
                    normalized.battlemetricsId,
                    dbBool(normalized.status),
                    normalized.lastScreenshot,
                    normalized.lastOnline,
                    normalized.lastWipe,
                    normalized.messageId,
                    normalized.clanTag,
                    dbBool(normalized.everyone),
                    dbBool(normalized.inGame),
                    normalized.img ?? null,
                    normalized.title ?? null,
                    normalized.serverId ?? null,
                ],
            );
            for (const [index, player] of normalized.players.entries()) {
                await this.insert(
                    client,
                    'tracker_players',
                    ['guild_id', 'tracker_id', 'player_index', 'name', 'steam_id', 'player_id'],
                    [guildId, trackerKey, index, player.name ?? null, player.steamId, player.playerId],
                );
            }
        }

        for (const listType of ['all', 'buy', 'sell'] as const) {
            for (const item of instance.marketSubscriptionList[listType] ?? []) {
                await this.insert(
                    client,
                    'market_subscriptions',
                    ['guild_id', 'list_type', 'item'],
                    [guildId, listType, item],
                );
            }
        }

        for (const item of instance.marketBlacklist ?? []) {
            await this.insert(client, 'market_blacklist', ['guild_id', 'item'], [guildId, item]);
        }

        for (const entryId of instance.blacklist.discordIds ?? []) {
            await this.insert(
                client,
                'blacklist_entries',
                ['guild_id', 'entry_type', 'entry_id'],
                [guildId, 'discord', entryId],
            );
        }

        for (const entryId of instance.blacklist.steamIds ?? []) {
            await this.insert(
                client,
                'blacklist_entries',
                ['guild_id', 'entry_type', 'entry_id'],
                [guildId, 'steam', entryId],
            );
        }

        for (const steamId of instance.whitelist.steamIds ?? []) {
            await this.insert(client, 'whitelist_entries', ['guild_id', 'steam_id'], [guildId, steamId]);
        }

        for (const alias of instance.aliases ?? []) {
            await this.insert(
                client,
                'aliases',
                ['guild_id', 'alias_index', 'alias', 'value'],
                [guildId, alias.index, alias.alias, alias.value],
            );
        }

        for (const [key, message] of Object.entries(instance.customIntlMessages ?? {})) {
            await this.insert(
                client,
                'custom_intl_messages',
                ['guild_id', 'message_key', 'message'],
                [guildId, key, message],
            );
        }

        for (const [steamId, color] of Object.entries(instance.teamChatColors ?? {})) {
            await this.insert(client, 'team_chat_colors', ['guild_id', 'steam_id', 'color'], [guildId, steamId, color]);
        }
    }

    private async hydrateGuildCollections(guildId: string, instance: Instance): Promise<void> {
        for (const row of await this.rows('SELECT * FROM trackers WHERE guild_id = ?', [guildId])) {
            instance.trackers[row.tracker_id] = {
                id: row.id,
                name: row.name,
                battlemetricsId: row.battlemetrics_id,
                status: fromDbBool(row.status),
                lastScreenshot: row.last_screenshot,
                lastOnline: row.last_online,
                lastWipe: row.last_wipe,
                messageId: row.message_id,
                clanTag: row.clan_tag,
                everyone: fromDbBool(row.everyone),
                inGame: fromDbBool(row.in_game),
                img: row.img,
                title: row.title,
                serverId: row.server_id,
                players: [],
            };
        }

        for (const row of await this.rows('SELECT * FROM tracker_players WHERE guild_id = ? ORDER BY player_index', [
            guildId,
        ])) {
            instance.trackers[row.tracker_id].players.push({
                name: row.name,
                steamId: row.steam_id,
                playerId: row.player_id,
            });
        }

        for (const row of await this.rows('SELECT * FROM market_subscriptions WHERE guild_id = ?', [guildId])) {
            instance.marketSubscriptionList[row.list_type as 'all' | 'buy' | 'sell'].push(row.item);
        }
        instance.marketBlacklist = (
            await this.rows('SELECT item FROM market_blacklist WHERE guild_id = ?', [guildId])
        ).map((row) => row.item);
        for (const row of await this.rows('SELECT * FROM blacklist_entries WHERE guild_id = ?', [guildId])) {
            if (row.entry_type === 'discord') instance.blacklist.discordIds.push(row.entry_id);
            if (row.entry_type === 'steam') instance.blacklist.steamIds.push(row.entry_id);
        }
        instance.whitelist.steamIds = (
            await this.rows('SELECT steam_id FROM whitelist_entries WHERE guild_id = ?', [guildId])
        ).map((row) => row.steam_id);
        instance.aliases = (
            await this.rows('SELECT * FROM aliases WHERE guild_id = ? ORDER BY alias_index', [guildId])
        ).map((row) => ({ index: row.alias_index, alias: row.alias, value: row.value }));
        for (const row of await this.rows('SELECT * FROM custom_intl_messages WHERE guild_id = ?', [guildId])) {
            instance.customIntlMessages[row.message_key] = row.message;
        }

        for (const row of await this.rows('SELECT * FROM team_chat_colors WHERE guild_id = ?', [guildId])) {
            instance.teamChatColors[row.steam_id] = row.color;
        }
    }

    private async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.database().connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private async insert(
        client: Pool | PoolClient,
        table: string,
        columns: string[],
        values: unknown[],
    ): Promise<void> {
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
    }

    private async rows(sql: string, values: unknown[] = []): Promise<Row[]> {
        return (await this.run(this.database(), sql, values)).rows;
    }

    private async run(client: Pool | PoolClient, sql: string, values: unknown[] = []) {
        return client.query(toPostgresSql(sql), values);
    }
}

function toPostgresSql(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
}

function sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function unionKeys<T extends object>(left: T | undefined, right: T | undefined): string[] {
    return Array.from(new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]));
}

function difference<T>(left: T[] = [], right: T[] = []): T[] {
    const rightSet = new Set(right);
    return left.filter((item) => !rightSet.has(item));
}
