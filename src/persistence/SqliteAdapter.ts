import fs from 'node:fs';
import Database from 'better-sqlite3';
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

export class SqliteAdapter implements PersistenceAdapter {
    readonly name = 'sqlite' as const;
    private db: Database.Database | null = null;

    constructor(
        private readonly sqlitePath: string,
        private readonly migrateLegacyJsonOnInit = true,
    ) {}

    async init(): Promise<void> {
        if (!fs.existsSync(this.sqlitePath)) {
            throw new Error(`SQLite database is missing at ${this.sqlitePath}. Run dbmate before starting the bot.`);
        }
        this.db = new Database(this.sqlitePath);
        this.db.pragma('foreign_keys = ON');
        this.validateMigrated();
        if (this.migrateLegacyJsonOnInit) {
            await this.migrateLegacyJson();
        } else {
            persistenceLogger.info(
                '[persistence] Legacy JSON migration is disabled for SQLite by RPP_MIGRATE_LEGACY_JSON=false.',
            );
        }
    }

    async close(): Promise<void> {
        this.db?.close();
        this.db = null;
    }

    listGuildIds(): string[] {
        return this.database()
            .prepare('SELECT guild_id FROM guilds ORDER BY guild_id')
            .all()
            .map((row: Row) => row.guild_id);
    }

    hasGuild(guildId: string): boolean {
        return Boolean(this.database().prepare('SELECT 1 FROM guilds WHERE guild_id = ?').get(guildId));
    }

    readGuildCore(guildId: string): GuildCoreState {
        const db = this.database();
        const guild = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId) as Row | undefined;
        if (!guild) {
            throw new Error(`No persisted guild state found for ${guildId}`);
        }

        return {
            firstTime: fromDbBool(guild.first_time),
            role: guild.role_id,
            adminRole: guild.admin_role_id,
            activeServer: guild.active_server_id,
            channelId: this.readChannelIds(db, guildId),
            informationMessageId: this.readInformationMessageIds(db, guildId),
        };
    }

    writeGuildCore(guildId: string, core: GuildCoreState): void {
        this.withTransaction(() => this.writeGuild(guildId, core));
    }

    updateGuildCoreFields(guildId: string, patch: GuildCorePatch): void {
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
        this.database()
            .prepare(`UPDATE guilds SET ${updates.join(', ')} WHERE guild_id = ?`)
            .run(...values, guildId);
    }

    readGuildSettings(guildId: string): GuildSettingsState {
        if (!this.hasGuild(guildId)) throw new Error(`No persisted guild state found for ${guildId}`);
        const instance = createEmptyInstance();
        this.readSettings(this.database(), guildId, instance);
        return {
            generalSettings: instance.generalSettings,
            notificationSettings: instance.notificationSettings,
        };
    }

    writeGuildSettings(guildId: string, settings: GuildSettingsState): void {
        this.withTransaction(() => {
            const db = this.database();
            db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(guildId);
            this.writeSettings(guildId, settings);
        });
    }

    setGuildSettings(guildId: string, updates: GuildSettingUpdate[]): void {
        if (updates.length === 0) return;
        this.withTransaction(() => {
            this.database()
                .prepare(
                    `INSERT INTO guild_settings (guild_id, setting_key, setting_value)
                    VALUES ${updates.map(() => '(?, ?, ?)').join(', ')}
                    ON CONFLICT(guild_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
                )
                .run(...updates.flatMap((update) => [guildId, update.key, update.value]));
        });
    }

    setDiscordReferencedIds(guildId: string, updates: DiscordReferenceUpdate[]): void {
        if (updates.length === 0) return;
        const upserts = updates.filter((update) => update.value !== null);
        const deletes = updates.filter((update) => update.value === null);

        this.withTransaction(() => {
            if (upserts.length > 0) {
                this.database()
                    .prepare(
                        `INSERT INTO guild_discord_ids (guild_id, id_key, id_value)
                        VALUES ${upserts.map(() => '(?, ?, ?)').join(', ')}
                        ON CONFLICT(guild_id, id_key) DO UPDATE SET id_value = excluded.id_value`,
                    )
                    .run(...upserts.flatMap((update) => [guildId, update.key, update.value]));
            }

            if (deletes.length > 0) {
                this.database()
                    .prepare(
                        `DELETE FROM guild_discord_ids
                        WHERE guild_id = ? AND id_key IN (${deletes.map(() => '?').join(', ')})`,
                    )
                    .run(guildId, ...deletes.map((update) => update.key));
            }
        });
    }

    readServers(guildId: string): Record<string, Server> {
        const instance = createEmptyInstance();
        this.hydrateServers(this.database(), guildId, instance);
        return instance.serverList;
    }

    readServerLiteEntries(guildId: string): Instance['serverListLite'] {
        const serverListLite: Instance['serverListLite'] = {};
        for (const row of this.database()
            .prepare('SELECT * FROM server_lite_entries WHERE guild_id = ?')
            .all(guildId) as Row[]) {
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

    replaceServerTimeSamples(
        guildId: string,
        serverId: string,
        timeTillDay: Server['timeTillDay'],
        timeTillNight: Server['timeTillNight'],
    ): void {
        this.withTransaction(() => {
            const db = this.database();
            db.prepare('DELETE FROM server_time_samples WHERE guild_id = ? AND server_id = ?').run(guildId, serverId);
            const insert = db.prepare(
                'INSERT INTO server_time_samples (guild_id, server_id, phase, sample_key, seconds) VALUES (?, ?, ?, ?, ?)',
            );
            for (const [phase, samples] of [
                ['day', timeTillDay],
                ['night', timeTillNight],
            ] as const) {
                for (const [sampleKey, seconds] of Object.entries(samples ?? {})) {
                    insert.run(guildId, serverId, phase, sampleKey, seconds);
                }
            }
        });
    }

    setServerMessageId(guildId: string, serverId: string, messageId: string | null): void {
        this.database()
            .prepare('UPDATE servers SET message_id = ? WHERE guild_id = ? AND server_id = ?')
            .run(messageId, guildId, serverId);
    }

    updateServerFields(
        guildId: string,
        serverId: string,
        patch: Parameters<PersistenceAdapter['updateServerFields']>[2],
    ): void {
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
        this.database()
            .prepare(`UPDATE servers SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ?`)
            .run(...values, guildId, serverId);
    }

    upsertServer(guildId: string, serverId: string, server: Server): void {
        this.withTransaction(() => {
            this.database().prepare('DELETE FROM servers WHERE guild_id = ? AND server_id = ?').run(guildId, serverId);
            this.insertServers(guildId, { serverList: { [serverId]: server } } as Instance);
        });
    }

    deleteServer(guildId: string, serverId: string): void {
        this.withTransaction(() => {
            this.database()
                .prepare('DELETE FROM server_lite_entries WHERE guild_id = ? AND server_id = ?')
                .run(guildId, serverId);
            this.database().prepare('DELETE FROM servers WHERE guild_id = ? AND server_id = ?').run(guildId, serverId);
        });
    }

    upsertServerLiteEntry(
        guildId: string,
        serverId: string,
        steamId: string,
        entry: Parameters<PersistenceAdapter['upsertServerLiteEntry']>[3],
    ): void {
        this.database()
            .prepare(
                `INSERT INTO server_lite_entries (guild_id, server_id, steam_id, server_ip, app_port, player_token)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, steam_id) DO UPDATE SET
                    server_ip = excluded.server_ip,
                    app_port = excluded.app_port,
                    player_token = excluded.player_token`,
            )
            .run(guildId, serverId, steamId, entry.serverIp, entry.appPort, entry.playerToken);
    }

    upsertMarker(
        guildId: string,
        serverId: string,
        markerKey: string,
        marker: Parameters<PersistenceAdapter['upsertMarker']>[3],
    ): void {
        this.database()
            .prepare(
                `INSERT INTO markers (guild_id, server_id, marker_key, x, y, location)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, marker_key) DO UPDATE SET
                    x = excluded.x,
                    y = excluded.y,
                    location = excluded.location`,
            )
            .run(guildId, serverId, markerKey, marker.x, marker.y, marker.location);
    }

    deleteMarker(guildId: string, serverId: string, markerKey: string): void {
        this.database()
            .prepare('DELETE FROM markers WHERE guild_id = ? AND server_id = ? AND marker_key = ?')
            .run(guildId, serverId, markerKey);
    }

    upsertNote(guildId: string, serverId: string, noteId: string | number, note: string): void {
        this.database()
            .prepare(
                `INSERT INTO notes (guild_id, server_id, note_id, note)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, note_id) DO UPDATE SET note = excluded.note`,
            )
            .run(guildId, serverId, noteId, note);
    }

    deleteNote(guildId: string, serverId: string, noteId: string | number): void {
        this.database()
            .prepare('DELETE FROM notes WHERE guild_id = ? AND server_id = ? AND note_id = ?')
            .run(guildId, serverId, noteId);
    }

    setTrackerMessageId(guildId: string, trackerId: string, messageId: string | null): void {
        this.database()
            .prepare('UPDATE trackers SET message_id = ? WHERE guild_id = ? AND tracker_id = ?')
            .run(messageId, guildId, trackerId);
    }

    updateTrackerFields(
        guildId: string,
        trackerId: string,
        patch: Parameters<PersistenceAdapter['updateTrackerFields']>[2],
    ): void {
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
        this.database()
            .prepare(`UPDATE trackers SET ${updates.join(', ')} WHERE guild_id = ? AND tracker_id = ?`)
            .run(...values, guildId, trackerId);
    }

    upsertTracker(guildId: string, trackerId: string, tracker: Tracker): void {
        this.withTransaction(() => {
            const db = this.database();
            db.prepare(
                `INSERT INTO trackers (
                    guild_id, tracker_id, id, name, battlemetrics_id, status, last_screenshot, last_online, last_wipe,
                    message_id, clan_tag, everyone, in_game, img, title, server_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, tracker_id) DO UPDATE SET
                    id = excluded.id,
                    name = excluded.name,
                    battlemetrics_id = excluded.battlemetrics_id,
                    status = excluded.status,
                    last_screenshot = excluded.last_screenshot,
                    last_online = excluded.last_online,
                    last_wipe = excluded.last_wipe,
                    message_id = excluded.message_id,
                    clan_tag = excluded.clan_tag,
                    everyone = excluded.everyone,
                    in_game = excluded.in_game,
                    img = excluded.img,
                    title = excluded.title,
                    server_id = excluded.server_id`,
            ).run(
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
            );
            db.prepare('DELETE FROM tracker_players WHERE guild_id = ? AND tracker_id = ?').run(guildId, trackerId);
        });
        this.replaceTrackerPlayers(guildId, trackerId, tracker.players);
    }

    deleteTracker(guildId: string, trackerId: string): void {
        this.database().prepare('DELETE FROM trackers WHERE guild_id = ? AND tracker_id = ?').run(guildId, trackerId);
    }

    replaceTrackerPlayers(guildId: string, trackerId: string, players: Tracker['players']): void {
        this.withTransaction(() => {
            const db = this.database();
            db.prepare('DELETE FROM tracker_players WHERE guild_id = ? AND tracker_id = ?').run(guildId, trackerId);
            const insert = db.prepare(
                `INSERT INTO tracker_players (guild_id, tracker_id, player_index, name, steam_id, player_id)
                VALUES (?, ?, ?, ?, ?, ?)`,
            );
            players.forEach((player, index) => {
                insert.run(guildId, trackerId, index, player.name ?? null, player.steamId, player.playerId);
            });
        });
    }

    setSmartSwitchMessageId(guildId: string, serverId: string, switchId: string, messageId: string | null): void {
        this.database()
            .prepare('UPDATE smart_switches SET message_id = ? WHERE guild_id = ? AND server_id = ? AND switch_id = ?')
            .run(messageId, guildId, serverId, switchId);
    }

    updateSmartSwitchFields(guildId: string, serverId: string, switchId: string, patch: SmartSwitchPatch): void {
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
        this.database()
            .prepare(
                `UPDATE smart_switches SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ? AND switch_id = ?`,
            )
            .run(...values, guildId, serverId, switchId);
    }

    upsertSmartSwitch(guildId: string, serverId: string, switchId: string, smartSwitch: SmartSwitch): void {
        this.database()
            .prepare(
                `INSERT INTO smart_switches (
                    guild_id, server_id, switch_id, name, active, reachable, location, x, y, image, command,
                    auto_day_night_on_off, proximity, message_id, everyone
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, switch_id) DO UPDATE SET
                    name = excluded.name,
                    active = excluded.active,
                    reachable = excluded.reachable,
                    location = excluded.location,
                    x = excluded.x,
                    y = excluded.y,
                    image = excluded.image,
                    command = excluded.command,
                    auto_day_night_on_off = excluded.auto_day_night_on_off,
                    proximity = excluded.proximity,
                    message_id = excluded.message_id,
                    everyone = excluded.everyone`,
            )
            .run(
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
            );
    }

    deleteSmartSwitch(guildId: string, serverId: string, switchId: string): void {
        this.database()
            .prepare('DELETE FROM smart_switches WHERE guild_id = ? AND server_id = ? AND switch_id = ?')
            .run(guildId, serverId, switchId);
    }

    setSmartAlarmMessageId(guildId: string, serverId: string, alarmId: string, messageId: string | null): void {
        this.database()
            .prepare('UPDATE smart_alarms SET message_id = ? WHERE guild_id = ? AND server_id = ? AND alarm_id = ?')
            .run(messageId, guildId, serverId, alarmId);
    }

    updateSmartAlarmFields(guildId: string, serverId: string, alarmId: string, patch: SmartAlarmPatch): void {
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
        this.database()
            .prepare(
                `UPDATE smart_alarms SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ? AND alarm_id = ?`,
            )
            .run(...values, guildId, serverId, alarmId);
    }

    upsertSmartAlarm(guildId: string, serverId: string, alarmId: string, smartAlarm: SmartAlarm): void {
        this.database()
            .prepare(
                `INSERT INTO smart_alarms (
                    guild_id, server_id, alarm_id, name, active, reachable, location, x, y, image, message, command,
                    last_trigger, in_game, message_id, everyone
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, alarm_id) DO UPDATE SET
                    name = excluded.name,
                    active = excluded.active,
                    reachable = excluded.reachable,
                    location = excluded.location,
                    x = excluded.x,
                    y = excluded.y,
                    image = excluded.image,
                    message = excluded.message,
                    command = excluded.command,
                    last_trigger = excluded.last_trigger,
                    in_game = excluded.in_game,
                    message_id = excluded.message_id,
                    everyone = excluded.everyone`,
            )
            .run(
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
            );
    }

    deleteSmartAlarm(guildId: string, serverId: string, alarmId: string): void {
        this.database()
            .prepare('DELETE FROM smart_alarms WHERE guild_id = ? AND server_id = ? AND alarm_id = ?')
            .run(guildId, serverId, alarmId);
    }

    setStorageMonitorMessageId(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        messageId: string | null,
    ): void {
        this.database()
            .prepare(
                'UPDATE storage_monitors SET message_id = ? WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
            )
            .run(messageId, guildId, serverId, storageMonitorId);
    }

    updateStorageMonitorFields(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        patch: StorageMonitorPatch,
    ): void {
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
        this.database()
            .prepare(
                `UPDATE storage_monitors SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?`,
            )
            .run(...values, guildId, serverId, storageMonitorId);
    }

    upsertStorageMonitor(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        storageMonitor: StorageMonitor,
    ): void {
        this.withTransaction(() => {
            const db = this.database();
            db.prepare(
                `INSERT INTO storage_monitors (
                    guild_id, server_id, storage_monitor_id, name, type, image, reachable, location, x, y, capacity,
                    decaying, in_game, message_id, everyone, upkeep
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, storage_monitor_id) DO UPDATE SET
                    name = excluded.name,
                    type = excluded.type,
                    image = excluded.image,
                    reachable = excluded.reachable,
                    location = excluded.location,
                    x = excluded.x,
                    y = excluded.y,
                    capacity = excluded.capacity,
                    decaying = excluded.decaying,
                    in_game = excluded.in_game,
                    message_id = excluded.message_id,
                    everyone = excluded.everyone,
                    upkeep = excluded.upkeep`,
            ).run(
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
            );
            db.prepare(
                'DELETE FROM storage_monitor_items WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
            ).run(guildId, serverId, storageMonitorId);
            const insertItem = db.prepare(
                'INSERT INTO storage_monitor_items (guild_id, server_id, storage_monitor_id, item_id, quantity) VALUES (?, ?, ?, ?, ?)',
            );
            for (const item of storageMonitor.items ?? []) {
                insertItem.run(guildId, serverId, storageMonitorId, item.itemId, item.quantity);
            }
        });
    }

    deleteStorageMonitor(guildId: string, serverId: string, storageMonitorId: string): void {
        this.database()
            .prepare('DELETE FROM storage_monitors WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?')
            .run(guildId, serverId, storageMonitorId);
    }

    setSmartSwitchGroupMessageId(guildId: string, serverId: string, groupId: string, messageId: string | null): void {
        this.database()
            .prepare('UPDATE switch_groups SET message_id = ? WHERE guild_id = ? AND server_id = ? AND group_id = ?')
            .run(messageId, guildId, serverId, groupId);
    }

    updateSmartSwitchGroupFields(
        guildId: string,
        serverId: string,
        groupId: string,
        patch: SmartSwitchGroupPatch,
    ): void {
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
        this.database()
            .prepare(
                `UPDATE switch_groups SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ? AND group_id = ?`,
            )
            .run(...values, guildId, serverId, groupId);
    }

    upsertSmartSwitchGroup(guildId: string, serverId: string, groupId: string, switchGroup: SwitchGroup): void {
        this.withTransaction(() => {
            const db = this.database();
            db.prepare(
                `INSERT INTO switch_groups (guild_id, server_id, group_id, name, active, image, command, message_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, group_id) DO UPDATE SET
                    name = excluded.name,
                    active = excluded.active,
                    image = excluded.image,
                    command = excluded.command,
                    message_id = excluded.message_id`,
            ).run(
                guildId,
                serverId,
                groupId,
                switchGroup.name,
                dbBool(switchGroup.active),
                switchGroup.image,
                switchGroup.command,
                switchGroup.messageId,
            );
            db.prepare('DELETE FROM switch_group_members WHERE guild_id = ? AND server_id = ? AND group_id = ?').run(
                guildId,
                serverId,
                groupId,
            );
            const insert = db.prepare(
                'INSERT INTO switch_group_members (guild_id, server_id, group_id, switch_id) VALUES (?, ?, ?, ?)',
            );
            for (const switchId of switchGroup.switches) insert.run(guildId, serverId, groupId, switchId);
        });
    }

    deleteSmartSwitchGroup(guildId: string, serverId: string, groupId: string): void {
        this.database()
            .prepare('DELETE FROM switch_groups WHERE guild_id = ? AND server_id = ? AND group_id = ?')
            .run(guildId, serverId, groupId);
    }

    replaceSmartSwitchGroupSwitches(
        guildId: string,
        serverId: string,
        groupId: string,
        switches: SwitchGroup['switches'],
    ): void {
        this.withTransaction(() => {
            const db = this.database();
            db.prepare('DELETE FROM switch_group_members WHERE guild_id = ? AND server_id = ? AND group_id = ?').run(
                guildId,
                serverId,
                groupId,
            );
            const insert = db.prepare(
                'INSERT INTO switch_group_members (guild_id, server_id, group_id, switch_id) VALUES (?, ?, ?, ?)',
            );
            for (const switchId of switches) insert.run(guildId, serverId, groupId, switchId);
        });
    }

    replaceServers(guildId: string, servers: Record<string, Server>): void {
        this.withTransaction(() => {
            const db = this.database();
            db.prepare('DELETE FROM servers WHERE guild_id = ?').run(guildId);
            this.insertServers(guildId, { serverList: servers } as Instance);
        });
    }

    readGuildCollections(guildId: string): GuildCollectionsState {
        const instance = createEmptyInstance();
        this.hydrateGuildCollections(this.database(), guildId, instance);
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

    upsertAlias(guildId: string, alias: Alias): void {
        this.database()
            .prepare(
                `INSERT INTO aliases (guild_id, alias_index, alias, value)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(guild_id, alias_index) DO UPDATE SET alias = excluded.alias, value = excluded.value`,
            )
            .run(guildId, alias.index, alias.alias, alias.value);
    }

    deleteAlias(guildId: string, index: number): void {
        this.database().prepare('DELETE FROM aliases WHERE guild_id = ? AND alias_index = ?').run(guildId, index);
    }

    setCustomIntlMessage(guildId: string, key: string, message: string | null): void {
        if (message === null) {
            this.database()
                .prepare('DELETE FROM custom_intl_messages WHERE guild_id = ? AND message_key = ?')
                .run(guildId, key);
            return;
        }
        this.database()
            .prepare(
                `INSERT INTO custom_intl_messages (guild_id, message_key, message)
                VALUES (?, ?, ?)
                ON CONFLICT(guild_id, message_key) DO UPDATE SET message = excluded.message`,
            )
            .run(guildId, key, message);
    }

    addBlacklistEntry(guildId: string, entryType: 'discord' | 'steam', entryId: string): void {
        this.database()
            .prepare('INSERT OR IGNORE INTO blacklist_entries (guild_id, entry_type, entry_id) VALUES (?, ?, ?)')
            .run(guildId, entryType, entryId);
    }

    removeBlacklistEntry(guildId: string, entryType: 'discord' | 'steam', entryId: string): void {
        this.database()
            .prepare('DELETE FROM blacklist_entries WHERE guild_id = ? AND entry_type = ? AND entry_id = ?')
            .run(guildId, entryType, entryId);
    }

    addWhitelistSteamId(guildId: string, steamId: string): void {
        this.database()
            .prepare('INSERT OR IGNORE INTO whitelist_entries (guild_id, steam_id) VALUES (?, ?)')
            .run(guildId, steamId);
    }

    removeWhitelistSteamId(guildId: string, steamId: string): void {
        this.database()
            .prepare('DELETE FROM whitelist_entries WHERE guild_id = ? AND steam_id = ?')
            .run(guildId, steamId);
    }

    addMarketSubscription(guildId: string, listType: 'all' | 'buy' | 'sell', item: string): void {
        this.database()
            .prepare('INSERT OR IGNORE INTO market_subscriptions (guild_id, list_type, item) VALUES (?, ?, ?)')
            .run(guildId, listType, item);
    }

    removeMarketSubscription(guildId: string, listType: 'all' | 'buy' | 'sell', item: string): void {
        this.database()
            .prepare('DELETE FROM market_subscriptions WHERE guild_id = ? AND list_type = ? AND item = ?')
            .run(guildId, listType, item);
    }

    addMarketBlacklistItem(guildId: string, item: string): void {
        this.database()
            .prepare('INSERT OR IGNORE INTO market_blacklist (guild_id, item) VALUES (?, ?)')
            .run(guildId, item);
    }

    removeMarketBlacklistItem(guildId: string, item: string): void {
        this.database().prepare('DELETE FROM market_blacklist WHERE guild_id = ? AND item = ?').run(guildId, item);
    }

    setTeamChatColor(guildId: string, steamId: string, color: string): void {
        this.database()
            .prepare(
                `INSERT INTO team_chat_colors (guild_id, steam_id, color)
                VALUES (?, ?, ?)
                ON CONFLICT(guild_id, steam_id) DO UPDATE SET color = excluded.color`,
            )
            .run(guildId, steamId, color);
    }

    replaceGuildCollections(guildId: string, collections: GuildCollectionsState): void {
        this.withTransaction(() => {
            const db = this.database();
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
                db.prepare(`DELETE FROM ${table} WHERE guild_id = ?`).run(guildId);
            }
            this.insertGuildCollections(guildId, collections as Instance);
        });
    }

    private writeInstance(guildId: string, instance: Instance): void {
        const db = this.database();
        const existingCredentials = this.hasGuild(guildId) ? this.readCredentials(guildId) : null;
        db.exec('BEGIN IMMEDIATE');
        try {
            db.prepare('DELETE FROM guilds WHERE guild_id = ?').run(guildId);
            this.writeGuild(guildId, instance);
            this.writeSettings(guildId, instance);
            this.insertServers(guildId, instance);
            this.insertServerLiteEntries(guildId, instance);
            this.insertGuildCollections(guildId, instance);
            if (existingCredentials) this.writeCredentialsRows(guildId, existingCredentials);
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }

    deleteGuild(guildId: string): void {
        this.database().prepare('DELETE FROM guilds WHERE guild_id = ?').run(guildId);
    }

    readCredentials(guildId: string): Credentials {
        const db = this.database();
        const credentials: Credentials = {
            hoster:
                (
                    db.prepare('SELECT steam_id FROM credentials_hoster WHERE guild_id = ?').get(guildId) as
                        | Row
                        | undefined
                )?.steam_id ?? null,
        };

        for (const row of db.prepare('SELECT * FROM fcm_credentials WHERE guild_id = ?').all(guildId) as Row[]) {
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

    writeCredentials(guildId: string, credentials: Credentials): void {
        const db = this.database();
        db.exec('BEGIN IMMEDIATE');
        try {
            this.writeCredentialsRows(guildId, credentials);
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }

    bootstrapGuildState(guildId: string, instance: Instance): void {
        this.writeInstance(guildId, instance);
    }

    async flush(): Promise<void> {}

    private patchGuildCore(guildId: string, base: Instance, next: Instance): void {
        const db = this.database();
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
            db.prepare(`UPDATE guilds SET ${coreUpdates.join(', ')} WHERE guild_id = ?`).run(...values, guildId);
        }

        for (const [property, idKey] of CHANNEL_ID_KEYS) {
            if (!sameJson(base.channelId[property], next.channelId[property])) {
                this.setDiscordId(guildId, idKey, next.channelId[property]);
            }
        }
        for (const [property, idKey] of INFORMATION_MESSAGE_ID_KEYS) {
            if (!sameJson(base.informationMessageId[property], next.informationMessageId[property])) {
                this.setDiscordId(guildId, idKey, next.informationMessageId[property]);
            }
        }
    }

    private patchGuildSettings(guildId: string, base: Instance, next: Instance): void {
        const db = this.database();
        const upsert = db.prepare(
            `INSERT INTO guild_settings (guild_id, setting_key, setting_value)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
        );
        for (const definition of PERSISTED_GUILD_SETTING_DEFINITIONS) {
            const baseValue = readGuildSettingValue(base, definition.key);
            const nextValue = readGuildSettingValue(next, definition.key);
            if (!sameJson(baseValue, nextValue)) {
                upsert.run(guildId, definition.key, serializeGuildSettingValue(definition, nextValue));
            }
        }
    }

    private patchServers(guildId: string, base: Instance, next: Instance): void {
        const db = this.database();
        for (const serverId of unionKeys(base.serverList, next.serverList)) {
            const baseServer = base.serverList[serverId];
            const nextServer = next.serverList[serverId];
            if (!nextServer) {
                db.prepare('DELETE FROM servers WHERE guild_id = ? AND server_id = ?').run(guildId, serverId);
                continue;
            }
            if (!baseServer) {
                this.insertServers(guildId, { serverList: { [serverId]: nextServer } });
                continue;
            }
            this.patchServer(guildId, serverId, baseServer, nextServer);
        }
    }

    private patchServer(guildId: string, serverId: string, base: Server, next: Server): void {
        const db = this.database();
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
            db.prepare(`UPDATE servers SET ${updates.join(', ')} WHERE guild_id = ? AND server_id = ?`).run(
                ...values,
                guildId,
                serverId,
            );
        }

        if (!sameJson(base.timeTillDay, next.timeTillDay) || !sameJson(base.timeTillNight, next.timeTillNight)) {
            db.prepare('DELETE FROM server_time_samples WHERE guild_id = ? AND server_id = ?').run(guildId, serverId);
            const insert = db.prepare(
                'INSERT INTO server_time_samples (guild_id, server_id, phase, sample_key, seconds) VALUES (?, ?, ?, ?, ?)',
            );
            for (const [phase, samples] of [
                ['day', next.timeTillDay],
                ['night', next.timeTillNight],
            ] as const) {
                for (const [sampleKey, seconds] of Object.entries(samples ?? {})) {
                    insert.run(guildId, serverId, phase, sampleKey, seconds);
                }
            }
        }

        this.patchSmartSwitches(guildId, serverId, base.switches ?? {}, next.switches ?? {});
        this.patchSmartAlarms(guildId, serverId, base.alarms ?? {}, next.alarms ?? {});
        this.patchStorageMonitors(guildId, serverId, base.storageMonitors ?? {}, next.storageMonitors ?? {});
        this.patchSwitchGroups(guildId, serverId, base.switchGroups ?? {}, next.switchGroups ?? {});
        this.patchCameraGroups(guildId, serverId, base.customCameraGroups ?? {}, next.customCameraGroups ?? {});
        this.patchMarkers(guildId, serverId, base.markers ?? {}, next.markers ?? {});
        this.patchNotes(guildId, serverId, base.notes ?? {}, next.notes ?? {});
    }

    private patchSmartSwitches(
        guildId: string,
        serverId: string,
        base: Record<number, SmartSwitch>,
        next: Record<number, SmartSwitch>,
    ): void {
        const db = this.database();
        for (const switchId of unionKeys(base, next)) {
            const nextSwitch = next[switchId];
            if (!nextSwitch) {
                db.prepare('DELETE FROM smart_switches WHERE guild_id = ? AND server_id = ? AND switch_id = ?').run(
                    guildId,
                    serverId,
                    switchId,
                );
            } else if (!sameJson(base[switchId], nextSwitch)) {
                db.prepare(
                    `INSERT INTO smart_switches (
                        guild_id, server_id, switch_id, name, active, reachable, location, x, y, image, command,
                        auto_day_night_on_off, proximity, message_id, everyone
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, switch_id) DO UPDATE SET
                        name = excluded.name,
                        active = excluded.active,
                        reachable = excluded.reachable,
                        location = excluded.location,
                        x = excluded.x,
                        y = excluded.y,
                        image = excluded.image,
                        command = excluded.command,
                        auto_day_night_on_off = excluded.auto_day_night_on_off,
                        proximity = excluded.proximity,
                        message_id = excluded.message_id,
                        everyone = excluded.everyone`,
                ).run(
                    guildId,
                    serverId,
                    switchId,
                    nextSwitch.name,
                    dbBool(nextSwitch.active),
                    dbBool(nextSwitch.reachable),
                    nextSwitch.location,
                    nextSwitch.x,
                    nextSwitch.y,
                    nextSwitch.image,
                    nextSwitch.command,
                    nextSwitch.autoDayNightOnOff,
                    nextSwitch.proximity,
                    nextSwitch.messageId,
                    nextSwitch.everyone == null ? null : dbBool(nextSwitch.everyone),
                );
            }
        }
    }

    private patchSmartAlarms(
        guildId: string,
        serverId: string,
        base: Record<number, SmartAlarm>,
        next: Record<number, SmartAlarm>,
    ): void {
        const db = this.database();
        for (const alarmId of unionKeys(base, next)) {
            const nextAlarm = next[alarmId];
            if (!nextAlarm) {
                db.prepare('DELETE FROM smart_alarms WHERE guild_id = ? AND server_id = ? AND alarm_id = ?').run(
                    guildId,
                    serverId,
                    alarmId,
                );
            } else if (!sameJson(base[alarmId], nextAlarm)) {
                db.prepare(
                    `INSERT INTO smart_alarms (
                        guild_id, server_id, alarm_id, name, active, reachable, location, x, y, image, message, command,
                        last_trigger, in_game, message_id, everyone
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, alarm_id) DO UPDATE SET
                        name = excluded.name,
                        active = excluded.active,
                        reachable = excluded.reachable,
                        location = excluded.location,
                        x = excluded.x,
                        y = excluded.y,
                        image = excluded.image,
                        message = excluded.message,
                        command = excluded.command,
                        last_trigger = excluded.last_trigger,
                        in_game = excluded.in_game,
                        message_id = excluded.message_id,
                        everyone = excluded.everyone`,
                ).run(
                    guildId,
                    serverId,
                    alarmId,
                    nextAlarm.name,
                    dbBool(nextAlarm.active),
                    dbBool(nextAlarm.reachable),
                    nextAlarm.location,
                    nextAlarm.x,
                    nextAlarm.y,
                    nextAlarm.image,
                    nextAlarm.message,
                    nextAlarm.command,
                    nextAlarm.lastTrigger,
                    dbBool(nextAlarm.inGame),
                    nextAlarm.messageId,
                    dbBool(nextAlarm.everyone),
                );
            }
        }
    }

    private patchStorageMonitors(
        guildId: string,
        serverId: string,
        base: Record<number, StorageMonitor>,
        next: Record<number, StorageMonitor>,
    ): void {
        const db = this.database();
        for (const monitorId of unionKeys(base, next)) {
            const nextMonitor = next[monitorId];
            if (!nextMonitor) {
                db.prepare(
                    'DELETE FROM storage_monitors WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
                ).run(guildId, serverId, monitorId);
                continue;
            }

            const baseWithoutItems = base[monitorId] ? { ...base[monitorId], items: [] } : undefined;
            const nextWithoutItems = { ...nextMonitor, items: [] };
            if (!sameJson(baseWithoutItems, nextWithoutItems)) {
                db.prepare(
                    `INSERT INTO storage_monitors (
                        guild_id, server_id, storage_monitor_id, name, type, image, reachable, location, x, y, capacity,
                        decaying, in_game, message_id, everyone, upkeep
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, storage_monitor_id) DO UPDATE SET
                        name = excluded.name,
                        type = excluded.type,
                        image = excluded.image,
                        reachable = excluded.reachable,
                        location = excluded.location,
                        x = excluded.x,
                        y = excluded.y,
                        capacity = excluded.capacity,
                        decaying = excluded.decaying,
                        in_game = excluded.in_game,
                        message_id = excluded.message_id,
                        everyone = excluded.everyone,
                        upkeep = excluded.upkeep`,
                ).run(
                    guildId,
                    serverId,
                    monitorId,
                    nextMonitor.name,
                    nextMonitor.type,
                    nextMonitor.image,
                    dbBool(nextMonitor.reachable),
                    nextMonitor.location,
                    nextMonitor.x,
                    nextMonitor.y,
                    nextMonitor.capacity,
                    nextMonitor.decaying == null ? null : dbBool(nextMonitor.decaying),
                    nextMonitor.inGame == null ? null : dbBool(nextMonitor.inGame),
                    nextMonitor.messageId,
                    dbBool(nextMonitor.everyone),
                    nextMonitor.upkeep ?? null,
                );
            }

            if (!sameJson(base[monitorId]?.items ?? [], nextMonitor.items ?? [])) {
                db.prepare(
                    'DELETE FROM storage_monitor_items WHERE guild_id = ? AND server_id = ? AND storage_monitor_id = ?',
                ).run(guildId, serverId, monitorId);
                const insertItem = db.prepare(
                    'INSERT INTO storage_monitor_items (guild_id, server_id, storage_monitor_id, item_id, quantity) VALUES (?, ?, ?, ?, ?)',
                );
                for (const item of nextMonitor.items ?? []) {
                    insertItem.run(guildId, serverId, monitorId, item.itemId, item.quantity);
                }
            }
        }
    }

    private patchSwitchGroups(
        guildId: string,
        serverId: string,
        base: Record<number, SwitchGroup>,
        next: Record<number, SwitchGroup>,
    ): void {
        const db = this.database();
        for (const groupId of unionKeys(base, next)) {
            const nextGroup = next[groupId];
            if (!nextGroup) {
                db.prepare('DELETE FROM switch_groups WHERE guild_id = ? AND server_id = ? AND group_id = ?').run(
                    guildId,
                    serverId,
                    groupId,
                );
                continue;
            }
            const baseWithoutMembers = base[groupId] ? { ...base[groupId], switches: [] } : undefined;
            const nextWithoutMembers = { ...nextGroup, switches: [] };
            if (!sameJson(baseWithoutMembers, nextWithoutMembers)) {
                db.prepare(
                    `INSERT INTO switch_groups (guild_id, server_id, group_id, name, active, image, command, message_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, group_id) DO UPDATE SET
                        name = excluded.name,
                        active = excluded.active,
                        image = excluded.image,
                        command = excluded.command,
                        message_id = excluded.message_id`,
                ).run(
                    guildId,
                    serverId,
                    groupId,
                    nextGroup.name,
                    dbBool(nextGroup.active),
                    nextGroup.image,
                    nextGroup.command,
                    nextGroup.messageId,
                );
            }
            if (!sameJson(base[groupId]?.switches ?? [], nextGroup.switches ?? [])) {
                db.prepare(
                    'DELETE FROM switch_group_members WHERE guild_id = ? AND server_id = ? AND group_id = ?',
                ).run(guildId, serverId, groupId);
                const insert = db.prepare(
                    'INSERT INTO switch_group_members (guild_id, server_id, group_id, switch_id) VALUES (?, ?, ?, ?)',
                );
                for (const switchId of nextGroup.switches ?? []) insert.run(guildId, serverId, groupId, switchId);
            }
        }
    }

    private patchCameraGroups(
        guildId: string,
        serverId: string,
        base: Server['customCameraGroups'],
        next: Server['customCameraGroups'],
    ): void {
        const db = this.database();
        for (const groupId of unionKeys(base, next)) {
            const nextGroup = next[groupId];
            if (!nextGroup) {
                db.prepare(
                    'DELETE FROM custom_camera_groups WHERE guild_id = ? AND server_id = ? AND group_id = ?',
                ).run(guildId, serverId, groupId);
                continue;
            }
            if (!sameJson(base[groupId]?.name, nextGroup.name)) {
                db.prepare(
                    `INSERT INTO custom_camera_groups (guild_id, server_id, group_id, name)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, group_id) DO UPDATE SET name = excluded.name`,
                ).run(guildId, serverId, groupId, nextGroup.name);
            }
            if (!sameJson(base[groupId]?.cameras ?? [], nextGroup.cameras ?? [])) {
                db.prepare(
                    'DELETE FROM custom_camera_group_members WHERE guild_id = ? AND server_id = ? AND group_id = ?',
                ).run(guildId, serverId, groupId);
                const insert = db.prepare(
                    'INSERT INTO custom_camera_group_members (guild_id, server_id, group_id, camera) VALUES (?, ?, ?, ?)',
                );
                for (const camera of nextGroup.cameras ?? []) insert.run(guildId, serverId, groupId, camera);
            }
        }
    }

    private patchMarkers(
        guildId: string,
        serverId: string,
        base: Record<string, Marker>,
        next: Record<string, Marker>,
    ) {
        const db = this.database();
        for (const markerKey of unionKeys(base, next)) {
            const marker = next[markerKey];
            if (!marker) {
                db.prepare('DELETE FROM markers WHERE guild_id = ? AND server_id = ? AND marker_key = ?').run(
                    guildId,
                    serverId,
                    markerKey,
                );
            } else if (!sameJson(base[markerKey], marker)) {
                db.prepare(
                    `INSERT INTO markers (guild_id, server_id, marker_key, x, y, location)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, marker_key) DO UPDATE SET
                        x = excluded.x,
                        y = excluded.y,
                        location = excluded.location`,
                ).run(guildId, serverId, markerKey, marker.x, marker.y, marker.location);
            }
        }
    }

    private patchNotes(guildId: string, serverId: string, base: Record<number, string>, next: Record<number, string>) {
        const db = this.database();
        for (const noteId of unionKeys(base, next)) {
            const note = next[noteId];
            if (note == null) {
                db.prepare('DELETE FROM notes WHERE guild_id = ? AND server_id = ? AND note_id = ?').run(
                    guildId,
                    serverId,
                    noteId,
                );
            } else if (!sameJson(base[noteId], note)) {
                db.prepare(
                    `INSERT INTO notes (guild_id, server_id, note_id, note)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(guild_id, server_id, note_id) DO UPDATE SET note = excluded.note`,
                ).run(guildId, serverId, noteId, note);
            }
        }
    }

    private patchGuildCollections(guildId: string, base: Instance, next: Instance): void {
        this.patchTrackers(guildId, base.trackers ?? {}, next.trackers ?? {});
        this.patchMarketSubscriptions(guildId, 'all', base.marketSubscriptionList.all, next.marketSubscriptionList.all);
        this.patchMarketSubscriptions(guildId, 'buy', base.marketSubscriptionList.buy, next.marketSubscriptionList.buy);
        this.patchMarketSubscriptions(
            guildId,
            'sell',
            base.marketSubscriptionList.sell,
            next.marketSubscriptionList.sell,
        );
        this.patchStringSet(guildId, 'market_blacklist', 'item', base.marketBlacklist, next.marketBlacklist);
        this.patchBlacklist(guildId, 'discord', base.blacklist.discordIds, next.blacklist.discordIds);
        this.patchBlacklist(guildId, 'steam', base.blacklist.steamIds, next.blacklist.steamIds);
        this.patchStringSet(guildId, 'whitelist_entries', 'steam_id', base.whitelist.steamIds, next.whitelist.steamIds);
        this.patchAliases(guildId, base.aliases ?? [], next.aliases ?? []);
        this.patchKeyValueCollection(
            guildId,
            'custom_intl_messages',
            'message_key',
            'message',
            base.customIntlMessages ?? {},
            next.customIntlMessages ?? {},
        );
        this.patchKeyValueCollection(
            guildId,
            'team_chat_colors',
            'steam_id',
            'color',
            base.teamChatColors ?? {},
            next.teamChatColors ?? {},
        );
    }

    private patchTrackers(guildId: string, base: Record<string, Tracker>, next: Record<string, Tracker>): void {
        const db = this.database();
        for (const trackerId of unionKeys(base, next)) {
            const tracker = next[trackerId];
            if (!tracker) {
                db.prepare('DELETE FROM trackers WHERE guild_id = ? AND tracker_id = ?').run(guildId, trackerId);
                continue;
            }
            const normalized = normalizeTracker(trackerId, tracker);
            const baseWithoutPlayers = base[trackerId]
                ? { ...normalizeTracker(trackerId, base[trackerId]), players: [] }
                : undefined;
            const nextWithoutPlayers = { ...normalized, players: [] };
            if (!sameJson(baseWithoutPlayers, nextWithoutPlayers)) {
                db.prepare(
                    `INSERT INTO trackers (
                        guild_id, tracker_id, id, name, battlemetrics_id, status, last_screenshot, last_online,
                        last_wipe, message_id, clan_tag, everyone, in_game, img, title, server_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(guild_id, tracker_id) DO UPDATE SET
                        id = excluded.id,
                        name = excluded.name,
                        battlemetrics_id = excluded.battlemetrics_id,
                        status = excluded.status,
                        last_screenshot = excluded.last_screenshot,
                        last_online = excluded.last_online,
                        last_wipe = excluded.last_wipe,
                        message_id = excluded.message_id,
                        clan_tag = excluded.clan_tag,
                        everyone = excluded.everyone,
                        in_game = excluded.in_game,
                        img = excluded.img,
                        title = excluded.title,
                        server_id = excluded.server_id`,
                ).run(
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
                );
            }
            if (!sameJson(base[trackerId]?.players ?? [], normalized.players ?? [])) {
                db.prepare('DELETE FROM tracker_players WHERE guild_id = ? AND tracker_id = ?').run(guildId, trackerId);
                const insertPlayer = db.prepare(
                    'INSERT INTO tracker_players (guild_id, tracker_id, player_index, name, steam_id, player_id) VALUES (?, ?, ?, ?, ?, ?)',
                );
                for (const [index, player] of normalized.players.entries()) {
                    insertPlayer.run(guildId, trackerId, index, player.name ?? null, player.steamId, player.playerId);
                }
            }
        }
    }

    private patchMarketSubscriptions(
        guildId: string,
        listType: 'all' | 'buy' | 'sell',
        baseItems: string[],
        nextItems: string[],
    ): void {
        const db = this.database();
        for (const item of difference(baseItems, nextItems)) {
            db.prepare('DELETE FROM market_subscriptions WHERE guild_id = ? AND list_type = ? AND item = ?').run(
                guildId,
                listType,
                item,
            );
        }
        const insert = db.prepare(
            'INSERT OR IGNORE INTO market_subscriptions (guild_id, list_type, item) VALUES (?, ?, ?)',
        );
        for (const item of difference(nextItems, baseItems)) insert.run(guildId, listType, item);
    }

    private patchBlacklist(guildId: string, entryType: 'discord' | 'steam', baseItems: string[], nextItems: string[]) {
        const db = this.database();
        for (const entryId of difference(baseItems, nextItems)) {
            db.prepare('DELETE FROM blacklist_entries WHERE guild_id = ? AND entry_type = ? AND entry_id = ?').run(
                guildId,
                entryType,
                entryId,
            );
        }
        const insert = db.prepare(
            'INSERT OR IGNORE INTO blacklist_entries (guild_id, entry_type, entry_id) VALUES (?, ?, ?)',
        );
        for (const entryId of difference(nextItems, baseItems)) insert.run(guildId, entryType, entryId);
    }

    private patchStringSet(
        guildId: string,
        table: 'market_blacklist' | 'whitelist_entries',
        column: 'item' | 'steam_id',
        baseItems: string[],
        nextItems: string[],
    ): void {
        const db = this.database();
        for (const item of difference(baseItems, nextItems)) {
            db.prepare(`DELETE FROM ${table} WHERE guild_id = ? AND ${column} = ?`).run(guildId, item);
        }
        const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (guild_id, ${column}) VALUES (?, ?)`);
        for (const item of difference(nextItems, baseItems)) insert.run(guildId, item);
    }

    private patchAliases(guildId: string, baseAliases: Alias[], nextAliases: Alias[]): void {
        const db = this.database();
        const baseByIndex = new Map(baseAliases.map((alias) => [alias.index, alias]));
        const nextByIndex = new Map(nextAliases.map((alias) => [alias.index, alias]));
        for (const index of new Set([...baseByIndex.keys(), ...nextByIndex.keys()])) {
            const nextAlias = nextByIndex.get(index);
            if (!nextAlias) {
                db.prepare('DELETE FROM aliases WHERE guild_id = ? AND alias_index = ?').run(guildId, index);
            } else if (!sameJson(baseByIndex.get(index), nextAlias)) {
                db.prepare(
                    `INSERT INTO aliases (guild_id, alias_index, alias, value)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(guild_id, alias_index) DO UPDATE SET
                        alias = excluded.alias,
                        value = excluded.value`,
                ).run(guildId, nextAlias.index, nextAlias.alias, nextAlias.value);
            }
        }
    }

    private patchKeyValueCollection(
        guildId: string,
        table: 'custom_intl_messages' | 'team_chat_colors',
        keyColumn: 'message_key' | 'steam_id',
        valueColumn: 'message' | 'color',
        base: Record<string, string>,
        next: Record<string, string>,
    ): void {
        const db = this.database();
        for (const key of unionKeys(base, next)) {
            const value = next[key];
            if (value == null) {
                db.prepare(`DELETE FROM ${table} WHERE guild_id = ? AND ${keyColumn} = ?`).run(guildId, key);
            } else if (!sameJson(base[key], value)) {
                db.prepare(
                    `INSERT INTO ${table} (guild_id, ${keyColumn}, ${valueColumn})
                    VALUES (?, ?, ?)
                    ON CONFLICT(guild_id, ${keyColumn}) DO UPDATE SET ${valueColumn} = excluded.${valueColumn}`,
                ).run(guildId, key, value);
            }
        }
    }

    private setDiscordId(guildId: string, idKey: string, value: string | null): void {
        const db = this.database();
        if (value) {
            db.prepare(
                `INSERT INTO guild_discord_ids (guild_id, id_key, id_value)
                VALUES (?, ?, ?)
                ON CONFLICT(guild_id, id_key) DO UPDATE SET id_value = excluded.id_value`,
            ).run(guildId, idKey, value);
        } else {
            db.prepare('DELETE FROM guild_discord_ids WHERE guild_id = ? AND id_key = ?').run(guildId, idKey);
        }
    }

    private database(): Database.Database {
        if (!this.db) throw new Error('SQLite persistence adapter has not been initialized');
        return this.db;
    }

    private withTransaction<T>(callback: () => T): T {
        const db = this.database();
        db.exec('BEGIN IMMEDIATE');
        try {
            const result = callback();
            db.exec('COMMIT');
            return result;
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }

    private validateMigrated(): void {
        try {
            const schemaVersion = (
                this.database().prepare("SELECT value FROM _persistence_meta WHERE key = 'schema_version'").get() as
                    | Row
                    | undefined
            )?.value;
            if (schemaVersion !== '1') {
                throw new Error(`expected schema_version=1, got ${schemaVersion ?? 'missing'}`);
            }
        } catch (error) {
            throw new Error(
                `SQLite persistence schema is missing or incomplete. Run dbmate before starting the bot. ${error}`,
            );
        }
    }

    private async migrateLegacyJson(): Promise<void> {
        const db = this.database();
        const status = (
            db.prepare("SELECT value FROM _persistence_meta WHERE key = 'legacy_json_migration_status'").get() as
                | Row
                | undefined
        )?.value;
        const source = new JsonAdapter();
        const manifest = source.sourceManifest();
        if (status === 'completed') {
            const migratedGuildCount = this.readMetaValue('legacy_json_migration_source_guild_count') ?? 'unknown';
            const migratedChecksum = this.readMetaValue('legacy_json_migration_source_checksum') ?? 'unknown';
            persistenceLogger.info(
                `[persistence] Legacy JSON migration already completed for SQLite; skipping. ` +
                    `Recorded source guilds=${migratedGuildCount}, recorded checksum=${migratedChecksum}, ` +
                    `current source guilds=${manifest.guildCount}, current checksum=${manifest.checksum}.`,
            );
            if (migratedChecksum !== 'unknown' && migratedChecksum !== manifest.checksum) {
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
                `[persistence] Legacy JSON migration has unexpected SQLite status '${status}'. ` +
                    'The adapter will attempt a new migration and overwrite that status.',
            );
        }

        persistenceLogger.info(
            `[persistence] Starting one-time legacy JSON to SQLite migration. ` +
                `Target state key: _persistence_meta.legacy_json_migration_status. ` +
                `Source guilds=${manifest.guildCount}, source checksum=${manifest.checksum}.`,
        );
        db.prepare(
            "INSERT OR REPLACE INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_status', 'in_progress', CURRENT_TIMESTAMP)",
        ).run();
        let migratedManifest: { guildCount: number; checksum: string };
        try {
            migratedManifest = await migrateFromJsonAdapter(source, this, persistenceLogger);
        } catch (error) {
            persistenceLogger.error(
                `[persistence] Legacy JSON to SQLite migration failed while status is in_progress. ` +
                    `The next startup will stop until _persistence_meta is inspected. Error: ${error}`,
            );
            throw error;
        }
        db.prepare(
            "INSERT OR REPLACE INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_status', 'completed', CURRENT_TIMESTAMP)",
        ).run();
        db.prepare(
            "INSERT OR REPLACE INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_source_guild_count', ?, CURRENT_TIMESTAMP)",
        ).run(String(migratedManifest.guildCount));
        db.prepare(
            "INSERT OR REPLACE INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_source_checksum', ?, CURRENT_TIMESTAMP)",
        ).run(migratedManifest.checksum);
        persistenceLogger.info(
            `[persistence] Completed legacy JSON to SQLite migration. ` +
                `Migrated guilds=${migratedManifest.guildCount}, source checksum=${migratedManifest.checksum}. ` +
                'Future startups will skip this migration because legacy_json_migration_status=completed.',
        );
    }

    private readMetaValue(key: string): string | null {
        return (
            this.database().prepare('SELECT value FROM _persistence_meta WHERE key = ?').get(key) as Row | undefined
        )?.value;
    }

    private writeCredentialsRows(guildId: string, credentials: Credentials): void {
        const db = this.database();
        db.prepare('DELETE FROM fcm_credentials WHERE guild_id = ?').run(guildId);
        db.prepare('DELETE FROM credentials_hoster WHERE guild_id = ?').run(guildId);
        db.prepare('INSERT INTO credentials_hoster (guild_id, steam_id) VALUES (?, ?)').run(
            guildId,
            credentials.hoster ?? null,
        );

        const insert = db.prepare(`
            INSERT INTO fcm_credentials (
                guild_id, steam_id, discord_user_id, gcm_android_id, gcm_security_token, issued_date, expire_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const [steamId, credential] of credentialEntries(credentials)) {
            insert.run(
                guildId,
                steamId,
                credential.discord_user_id ?? '',
                (credential.gcm as Row | undefined)?.android_id ?? credential.gcm_android_id ?? '',
                (credential.gcm as Row | undefined)?.security_token ?? credential.gcm_security_token ?? '',
                credential.issuedDate ?? credential.issued_date ?? null,
                credential.expireDate ?? credential.expire_date ?? null,
            );
        }
    }

    private writeGuild(guildId: string, instance: GuildCoreState): void {
        const db = this.database();
        db.prepare(
            `INSERT INTO guilds (guild_id, first_time, role_id, admin_role_id, active_server_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                first_time = excluded.first_time,
                role_id = excluded.role_id,
                admin_role_id = excluded.admin_role_id,
                active_server_id = excluded.active_server_id`,
        ).run(guildId, dbBool(instance.firstTime), instance.role, instance.adminRole, instance.activeServer);

        db.prepare('DELETE FROM guild_discord_ids WHERE guild_id = ?').run(guildId);
        const insertId = db.prepare('INSERT INTO guild_discord_ids (guild_id, id_key, id_value) VALUES (?, ?, ?)');
        for (const [property, idKey] of CHANNEL_ID_KEYS) {
            const value = instance.channelId[property];
            if (value) insertId.run(guildId, idKey, value);
        }
        for (const [property, idKey] of INFORMATION_MESSAGE_ID_KEYS) {
            const value = instance.informationMessageId[property];
            if (value) insertId.run(guildId, idKey, value);
        }
    }

    private writeSettings(guildId: string, instance: GuildSettingsState): void {
        const insert = this.database().prepare(
            'INSERT INTO guild_settings (guild_id, setting_key, setting_value) VALUES (?, ?, ?)',
        );
        for (const definition of PERSISTED_GUILD_SETTING_DEFINITIONS) {
            const value = readGuildSettingValue(instance, definition.key);
            insert.run(guildId, definition.key, serializeGuildSettingValue(definition, value));
        }
    }

    private readSettings(db: Database.Database, guildId: string, instance: Instance): void {
        instance.generalSettings = buildDefaultGeneralSettings();
        instance.notificationSettings = buildDefaultNotificationSettings();
        for (const row of db
            .prepare('SELECT setting_key, setting_value FROM guild_settings WHERE guild_id = ?')
            .all(guildId) as Row[]) {
            applyPersistedGuildSetting(instance, row.setting_key, row.setting_value);
        }
    }

    private readChannelIds(db: Database.Database, guildId: string): GuildCoreState['channelId'] {
        const channelId = createEmptyInstance().channelId;
        const rows = db
            .prepare("SELECT id_key, id_value FROM guild_discord_ids WHERE guild_id = ? AND id_key LIKE 'channel.%'")
            .all(guildId) as Row[];
        const rowsByKey = new Map(rows.map((row) => [row.id_key, row.id_value]));
        for (const [property, idKey] of CHANNEL_ID_KEYS) {
            channelId[property] = rowsByKey.get(idKey) ?? null;
        }
        return channelId;
    }

    private readInformationMessageIds(db: Database.Database, guildId: string): GuildCoreState['informationMessageId'] {
        const informationMessageId = createEmptyInstance().informationMessageId;
        const rows = db
            .prepare(
                "SELECT id_key, id_value FROM guild_discord_ids WHERE guild_id = ? AND id_key LIKE 'informationMessage.%'",
            )
            .all(guildId) as Row[];
        const rowsByKey = new Map(rows.map((row) => [row.id_key, row.id_value]));
        for (const [property, idKey] of INFORMATION_MESSAGE_ID_KEYS) {
            informationMessageId[property] = rowsByKey.get(idKey) ?? null;
        }
        return informationMessageId;
    }

    private insertServers(guildId: string, instance: Pick<Instance, 'serverList'>): void {
        const db = this.database();
        const insertServer = db.prepare(`
            INSERT INTO servers (
                guild_id, server_id, title, server_ip, app_port, steam_id, player_token, battlemetrics_id,
                cargo_ship_egress_time_ms, oil_rig_locked_crate_unlock_time_ms, deep_sea_min_wipe_cooldown_ms,
                deep_sea_max_wipe_cooldown_ms, deep_sea_wipe_duration_ms, message_id, connect, img, url, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertTime = db.prepare(
            'INSERT INTO server_time_samples (guild_id, server_id, phase, sample_key, seconds) VALUES (?, ?, ?, ?, ?)',
        );
        const insertSwitch = db.prepare(`
            INSERT INTO smart_switches (
                guild_id, server_id, switch_id, name, active, reachable, location, x, y, image, command,
                auto_day_night_on_off, proximity, message_id, everyone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertAlarm = db.prepare(`
            INSERT INTO smart_alarms (
                guild_id, server_id, alarm_id, name, active, reachable, location, x, y, image, message, command,
                last_trigger, in_game, message_id, everyone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMonitor = db.prepare(`
            INSERT INTO storage_monitors (
                guild_id, server_id, storage_monitor_id, name, type, image, reachable, location, x, y, capacity,
                decaying, in_game, message_id, everyone, upkeep
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMonitorItem = db.prepare(
            'INSERT INTO storage_monitor_items (guild_id, server_id, storage_monitor_id, item_id, quantity) VALUES (?, ?, ?, ?, ?)',
        );
        const insertGroup = db.prepare(
            'INSERT INTO switch_groups (guild_id, server_id, group_id, name, active, image, command, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        const insertGroupMember = db.prepare(
            'INSERT INTO switch_group_members (guild_id, server_id, group_id, switch_id) VALUES (?, ?, ?, ?)',
        );
        const insertCameraGroup = db.prepare(
            'INSERT INTO custom_camera_groups (guild_id, server_id, group_id, name) VALUES (?, ?, ?, ?)',
        );
        const insertCamera = db.prepare(
            'INSERT INTO custom_camera_group_members (guild_id, server_id, group_id, camera) VALUES (?, ?, ?, ?)',
        );
        const insertMarker = db.prepare(
            'INSERT INTO markers (guild_id, server_id, marker_key, x, y, location) VALUES (?, ?, ?, ?, ?, ?)',
        );
        const insertNote = db.prepare('INSERT INTO notes (guild_id, server_id, note_id, note) VALUES (?, ?, ?, ?)');

        for (const [serverId, server] of Object.entries(instance.serverList)) {
            insertServer.run(
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
            );
            for (const [phase, samples] of [
                ['day', server.timeTillDay],
                ['night', server.timeTillNight],
            ] as const) {
                for (const [sampleKey, seconds] of Object.entries(samples ?? {})) {
                    insertTime.run(guildId, serverId, phase, sampleKey, seconds);
                }
            }

            for (const [switchId, smartSwitch] of Object.entries(server.switches ?? {})) {
                insertSwitch.run(
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
                );
            }

            for (const [alarmId, alarm] of Object.entries(server.alarms ?? {})) {
                insertAlarm.run(
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
                );
            }

            for (const [monitorId, monitor] of Object.entries(server.storageMonitors ?? {})) {
                insertMonitor.run(
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
                );
                for (const item of monitor.items ?? []) {
                    insertMonitorItem.run(guildId, serverId, monitorId, item.itemId, item.quantity);
                }
            }

            for (const [groupId, group] of Object.entries(server.switchGroups ?? {})) {
                insertGroup.run(
                    guildId,
                    serverId,
                    groupId,
                    group.name,
                    dbBool(group.active),
                    group.image,
                    group.command,
                    group.messageId,
                );
                for (const switchId of group.switches ?? []) {
                    insertGroupMember.run(guildId, serverId, groupId, switchId);
                }
            }

            for (const [groupId, group] of Object.entries(server.customCameraGroups ?? {})) {
                insertCameraGroup.run(guildId, serverId, groupId, group.name);
                for (const camera of group.cameras ?? []) {
                    insertCamera.run(guildId, serverId, groupId, camera);
                }
            }

            for (const [markerKey, marker] of Object.entries(server.markers ?? {})) {
                insertMarker.run(guildId, serverId, markerKey, marker.x, marker.y, marker.location);
            }

            for (const [noteId, note] of Object.entries(server.notes ?? {})) {
                insertNote.run(guildId, serverId, noteId, note);
            }
        }
    }

    private insertServerLiteEntries(guildId: string, instance: Pick<Instance, 'serverListLite'>): void {
        const insertLiteEntry = this.database().prepare(
            `INSERT INTO server_lite_entries (guild_id, server_id, steam_id, server_ip, app_port, player_token)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, server_id, steam_id) DO UPDATE SET
                server_ip = excluded.server_ip,
                app_port = excluded.app_port,
                player_token = excluded.player_token`,
        );
        for (const [serverId, entries] of Object.entries(instance.serverListLite ?? {})) {
            for (const [steamId, entry] of Object.entries(entries ?? {})) {
                insertLiteEntry.run(guildId, serverId, steamId, entry.serverIp, entry.appPort, entry.playerToken);
            }
        }
    }

    private hydrateServers(db: Database.Database, guildId: string, instance: Instance): void {
        for (const row of db.prepare('SELECT * FROM servers WHERE guild_id = ?').all(guildId) as Row[]) {
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

        for (const row of db.prepare('SELECT * FROM server_time_samples WHERE guild_id = ?').all(guildId) as Row[]) {
            const server = instance.serverList[row.server_id];
            if (!server) continue;
            const target = row.phase === 'day' ? 'timeTillDay' : 'timeTillNight';
            server[target] ??= {};
            server[target][row.sample_key] = row.seconds;
        }

        for (const row of db.prepare('SELECT * FROM smart_switches WHERE guild_id = ?').all(guildId) as Row[]) {
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

        for (const row of db.prepare('SELECT * FROM smart_alarms WHERE guild_id = ?').all(guildId) as Row[]) {
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

        for (const row of db.prepare('SELECT * FROM storage_monitors WHERE guild_id = ?').all(guildId) as Row[]) {
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

        for (const row of db.prepare('SELECT * FROM storage_monitor_items WHERE guild_id = ?').all(guildId) as Row[]) {
            instance.serverList[row.server_id].storageMonitors[row.storage_monitor_id].items.push({
                itemId: row.item_id,
                quantity: row.quantity,
            });
        }

        for (const row of db.prepare('SELECT * FROM switch_groups WHERE guild_id = ?').all(guildId) as Row[]) {
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

        for (const row of db.prepare('SELECT * FROM switch_group_members WHERE guild_id = ?').all(guildId) as Row[]) {
            instance.serverList[row.server_id].switchGroups[row.group_id].switches.push(row.switch_id);
        }

        for (const row of db.prepare('SELECT * FROM custom_camera_groups WHERE guild_id = ?').all(guildId) as Row[]) {
            instance.serverList[row.server_id].customCameraGroups[row.group_id] = {
                id: row.group_id,
                name: row.name,
                cameras: [],
            };
        }

        for (const row of db
            .prepare('SELECT * FROM custom_camera_group_members WHERE guild_id = ?')
            .all(guildId) as Row[]) {
            instance.serverList[row.server_id].customCameraGroups[row.group_id].cameras.push(row.camera);
        }

        for (const row of db.prepare('SELECT * FROM markers WHERE guild_id = ?').all(guildId) as Row[]) {
            instance.serverList[row.server_id].markers[row.marker_key] = {
                x: row.x,
                y: row.y,
                location: row.location,
            };
        }

        for (const row of db.prepare('SELECT * FROM notes WHERE guild_id = ?').all(guildId) as Row[]) {
            instance.serverList[row.server_id].notes[row.note_id] = row.note;
        }
    }

    private insertGuildCollections(guildId: string, instance: Pick<Instance, keyof GuildCollectionsState>): void {
        const db = this.database();
        const insertTracker = db.prepare(`
            INSERT INTO trackers (
                guild_id, tracker_id, id, name, battlemetrics_id, status, last_screenshot, last_online, last_wipe,
                message_id, clan_tag, everyone, in_game, img, title, server_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertTrackerPlayer = db.prepare(
            'INSERT INTO tracker_players (guild_id, tracker_id, player_index, name, steam_id, player_id) VALUES (?, ?, ?, ?, ?, ?)',
        );
        for (const [trackerKey, tracker] of Object.entries(instance.trackers)) {
            const normalized = normalizeTracker(trackerKey, tracker);
            insertTracker.run(
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
            );
            normalized.players.forEach((player, index) =>
                insertTrackerPlayer.run(
                    guildId,
                    trackerKey,
                    index,
                    player.name ?? null,
                    player.steamId,
                    player.playerId,
                ),
            );
        }

        const insertMarketSubscription = db.prepare(
            'INSERT INTO market_subscriptions (guild_id, list_type, item) VALUES (?, ?, ?)',
        );
        for (const listType of ['all', 'buy', 'sell'] as const) {
            for (const item of instance.marketSubscriptionList[listType] ?? []) {
                insertMarketSubscription.run(guildId, listType, item);
            }
        }

        for (const item of instance.marketBlacklist ?? []) {
            db.prepare('INSERT INTO market_blacklist (guild_id, item) VALUES (?, ?)').run(guildId, item);
        }

        for (const entryId of instance.blacklist.discordIds ?? []) {
            db.prepare('INSERT INTO blacklist_entries (guild_id, entry_type, entry_id) VALUES (?, ?, ?)').run(
                guildId,
                'discord',
                entryId,
            );
        }

        for (const entryId of instance.blacklist.steamIds ?? []) {
            db.prepare('INSERT INTO blacklist_entries (guild_id, entry_type, entry_id) VALUES (?, ?, ?)').run(
                guildId,
                'steam',
                entryId,
            );
        }

        for (const steamId of instance.whitelist.steamIds ?? []) {
            db.prepare('INSERT INTO whitelist_entries (guild_id, steam_id) VALUES (?, ?)').run(guildId, steamId);
        }

        for (const alias of instance.aliases ?? []) {
            db.prepare('INSERT INTO aliases (guild_id, alias_index, alias, value) VALUES (?, ?, ?, ?)').run(
                guildId,
                alias.index,
                alias.alias,
                alias.value,
            );
        }

        for (const [key, message] of Object.entries(instance.customIntlMessages ?? {})) {
            db.prepare('INSERT INTO custom_intl_messages (guild_id, message_key, message) VALUES (?, ?, ?)').run(
                guildId,
                key,
                message,
            );
        }

        for (const [steamId, color] of Object.entries(instance.teamChatColors ?? {})) {
            db.prepare('INSERT INTO team_chat_colors (guild_id, steam_id, color) VALUES (?, ?, ?)').run(
                guildId,
                steamId,
                color,
            );
        }
    }

    private hydrateGuildCollections(db: Database.Database, guildId: string, instance: Instance): void {
        for (const row of db.prepare('SELECT * FROM trackers WHERE guild_id = ?').all(guildId) as Row[]) {
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

        for (const row of db
            .prepare('SELECT * FROM tracker_players WHERE guild_id = ? ORDER BY player_index')
            .all(guildId) as Row[]) {
            instance.trackers[row.tracker_id].players.push({
                name: row.name,
                steamId: row.steam_id,
                playerId: row.player_id,
            });
        }

        for (const row of db.prepare('SELECT * FROM market_subscriptions WHERE guild_id = ?').all(guildId) as Row[]) {
            instance.marketSubscriptionList[row.list_type as 'all' | 'buy' | 'sell'].push(row.item);
        }
        instance.marketBlacklist = (
            db.prepare('SELECT item FROM market_blacklist WHERE guild_id = ?').all(guildId) as Row[]
        ).map((row) => row.item);
        for (const row of db.prepare('SELECT * FROM blacklist_entries WHERE guild_id = ?').all(guildId) as Row[]) {
            if (row.entry_type === 'discord') instance.blacklist.discordIds.push(row.entry_id);
            if (row.entry_type === 'steam') instance.blacklist.steamIds.push(row.entry_id);
        }
        instance.whitelist.steamIds = (
            db.prepare('SELECT steam_id FROM whitelist_entries WHERE guild_id = ?').all(guildId) as Row[]
        ).map((row) => row.steam_id);
        instance.aliases = (
            db.prepare('SELECT * FROM aliases WHERE guild_id = ? ORDER BY alias_index').all(guildId) as Row[]
        ).map((row) => ({ index: row.alias_index, alias: row.alias, value: row.value }));
        for (const row of db.prepare('SELECT * FROM custom_intl_messages WHERE guild_id = ?').all(guildId) as Row[]) {
            instance.customIntlMessages[row.message_key] = row.message;
        }

        for (const row of db.prepare('SELECT * FROM team_chat_colors WHERE guild_id = ?').all(guildId) as Row[]) {
            instance.teamChatColors[row.steam_id] = row.color;
        }
    }
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
