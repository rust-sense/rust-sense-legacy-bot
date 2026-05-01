import { Pool, type PoolClient } from 'pg';
import type { Credentials, Instance, Server } from '../types/instance.js';
import { loadJsonResourceSync } from '../utils/filesystemUtils.js';
import { legacyGuildIds, legacySourceManifest, readLegacyCredentials, readLegacyInstance } from './legacyJson.js';
import {
    addServerLite,
    createEmptyInstance,
    credentialEntries,
    dbBool,
    fromDbBool,
    GENERAL_COLUMNS,
    NOTIFICATION_COLUMNS,
    normalizeTracker,
} from './relationalMapping.js';
import type { PersistenceAdapter } from './types.js';

type Row = Record<string, any>;

export class PostgresAdapter implements PersistenceAdapter {
    readonly name = 'postgres' as const;
    private pool: Pool | null = null;
    private readonly instances: Record<string, Instance> = {};
    private readonly credentials: Record<string, Credentials> = {};
    private writeQueue: Promise<unknown> = Promise.resolve();
    private writeError: unknown = null;
    private readonly generalTemplate = loadJsonResourceSync<Instance['generalSettings']>(
        'templates/generalSettingsTemplate.json',
    );
    private readonly notificationTemplate = loadJsonResourceSync<Instance['notificationSettings']>(
        'templates/notificationSettingsTemplate.json',
    );

    constructor(private readonly connectionString: string) {}

    async init(): Promise<void> {
        this.pool = new Pool({ connectionString: this.connectionString });
        await this.validateMigrated();
        await this.migrateLegacyJson();
        await this.loadCacheFromDatabase();
    }

    async close(): Promise<void> {
        await this.flush();
        await this.pool?.end();
        this.pool = null;
    }

    listGuildIds(): string[] {
        return Object.keys(this.instances).sort();
    }

    hasGuild(guildId: string): boolean {
        return guildId in this.instances;
    }

    readInstance(guildId: string): Instance {
        const instance = this.instances[guildId];
        if (!instance) throw new Error(`No persisted guild state found for ${guildId}`);
        return instance;
    }

    writeInstance(guildId: string, instance: Instance): void {
        this.instances[guildId] = instance;
        this.enqueueWrite(() => this.writeInstanceAsync(guildId, instance));
    }

    deleteGuild(guildId: string): void {
        delete this.instances[guildId];
        delete this.credentials[guildId];
        this.enqueueWrite(() =>
            this.withTransaction((client) => this.run(client, 'DELETE FROM guilds WHERE guild_id = ?', [guildId])),
        );
    }

    readCredentials(guildId: string): Credentials {
        return this.credentials[guildId] ?? { hoster: null };
    }

    writeCredentials(guildId: string, credentials: Credentials): void {
        this.credentials[guildId] = credentials;
        this.enqueueWrite(() => this.writeCredentialsAsync(guildId, credentials));
    }

    async flush(): Promise<void> {
        await this.writeQueue;
        if (this.writeError) {
            const error = this.writeError;
            this.writeError = null;
            throw error;
        }
    }

    private database(): Pool {
        if (!this.pool) throw new Error('Postgres persistence adapter has not been initialized');
        return this.pool;
    }

    private async validateMigrated(): Promise<void> {
        try {
            await this.database().query("SELECT 1 FROM _persistence_meta WHERE key = 'schema_validation'");
        } catch (error) {
            throw new Error(
                `Postgres persistence schema is missing or incomplete. Run dbmate before starting the bot. ${error}`,
            );
        }
    }

    private async loadCacheFromDatabase(): Promise<void> {
        const guildIds = (await this.rows('SELECT guild_id FROM guilds ORDER BY guild_id')).map((row) => row.guild_id);
        for (const guildId of guildIds) {
            this.instances[guildId] = await this.readInstanceFromDatabase(guildId);
            this.credentials[guildId] = await this.readCredentialsFromDatabase(guildId);
        }
    }

    private async migrateLegacyJson(): Promise<void> {
        const status = (
            await this.rows("SELECT value FROM _persistence_meta WHERE key = 'legacy_json_migration_status'")
        )[0]?.value;
        if (status === 'completed') return;
        if (status === 'in_progress') {
            throw new Error(
                'Legacy JSON migration is marked in_progress. Inspect persistence state before restarting.',
            );
        }

        const guildIds = legacyGuildIds();
        const manifest = legacySourceManifest();
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_status', 'in_progress', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
        );
        try {
            for (const guildId of guildIds) {
                await this.writeInstanceAsync(guildId, readLegacyInstance(guildId));
                await this.writeCredentialsAsync(guildId, readLegacyCredentials(guildId));
            }
        } catch (error) {
            throw error;
        }
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_status', 'completed', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
        );
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_source_guild_count', ?, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
            [String(guildIds.length)],
        );
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_source_checksum', ?, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
            [manifest.checksum],
        );
    }

    private async writeInstanceAsync(guildId: string, instance: Instance): Promise<void> {
        const existingCredentials = this.credentials[guildId] ?? (await this.readCredentialsFromDatabase(guildId));
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM guilds WHERE guild_id = ?', [guildId]);
            await this.writeGuild(client, guildId, instance);
            await this.writeSettings(client, guildId, instance);
            await this.writeServers(client, guildId, instance);
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

        const instance = createEmptyInstance({ ...this.generalTemplate }, structuredClone(this.notificationTemplate));
        instance.firstTime = fromDbBool(guild.first_time);
        instance.role = guild.role_id;
        instance.adminRole = guild.admin_role_id;
        instance.activeServer = guild.active_server_id;
        instance.channelId = {
            category: guild.channel_category_id,
            information: guild.channel_information_id,
            servers: guild.channel_servers_id,
            settings: guild.channel_settings_id,
            commands: guild.channel_commands_id,
            events: guild.channel_events_id,
            teamchat: guild.channel_teamchat_id,
            switches: guild.channel_switches_id,
            switchGroups: guild.channel_switch_groups_id,
            alarms: guild.channel_alarms_id,
            storageMonitors: guild.channel_storage_monitors_id,
            activity: guild.channel_activity_id,
            trackers: guild.channel_trackers_id,
        };
        instance.informationMessageId = {
            map: guild.information_map_message_id,
            server: guild.information_server_message_id,
            event: guild.information_event_message_id,
            team: guild.information_team_message_id,
            battlemetricsPlayers: guild.information_battlemetrics_players_message_id,
        };

        await this.readSettings(guildId, instance);
        await this.readServers(guildId, instance);
        await this.readGuildCollections(guildId, instance);
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
                    androidId: row.gcm_android_id,
                    securityToken: row.gcm_security_token,
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
                    (credential.gcm as Row | undefined)?.androidId ?? credential.gcm_android_id ?? '',
                    (credential.gcm as Row | undefined)?.securityToken ?? credential.gcm_security_token ?? '',
                    credential.issuedDate ?? credential.issued_date ?? null,
                    credential.expireDate ?? credential.expire_date ?? null,
                ],
            );
        }
    }

    private async writeGuild(client: PoolClient, guildId: string, instance: Instance): Promise<void> {
        await this.run(
            client,
            `INSERT INTO guilds (
                guild_id, first_time, role_id, admin_role_id, active_server_id,
                channel_category_id, channel_information_id, channel_servers_id, channel_settings_id,
                channel_commands_id, channel_events_id, channel_teamchat_id, channel_switches_id,
                channel_switch_groups_id, channel_alarms_id, channel_storage_monitors_id, channel_activity_id,
                channel_trackers_id, information_map_message_id, information_server_message_id,
                information_event_message_id, information_team_message_id, information_battlemetrics_players_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                guildId,
                dbBool(instance.firstTime),
                instance.role,
                instance.adminRole,
                instance.activeServer,
                instance.channelId.category,
                instance.channelId.information,
                instance.channelId.servers,
                instance.channelId.settings,
                instance.channelId.commands,
                instance.channelId.events,
                instance.channelId.teamchat,
                instance.channelId.switches,
                instance.channelId.switchGroups,
                instance.channelId.alarms,
                instance.channelId.storageMonitors,
                instance.channelId.activity,
                instance.channelId.trackers,
                instance.informationMessageId.map,
                instance.informationMessageId.server,
                instance.informationMessageId.event,
                instance.informationMessageId.team,
                instance.informationMessageId.battlemetricsPlayers,
            ],
        );
    }

    private async writeSettings(client: PoolClient, guildId: string, instance: Instance): Promise<void> {
        const generalColumns = ['guild_id', ...GENERAL_COLUMNS.map(([, column]) => column)];
        await this.insert(client, 'guild_general_settings', generalColumns, [
            guildId,
            ...GENERAL_COLUMNS.map(([key]) => {
                const value = instance.generalSettings[key] ?? this.generalTemplate[key];
                return typeof value === 'boolean' ? dbBool(value) : value;
            }),
        ]);

        const notificationColumns = [
            'guild_id',
            ...NOTIFICATION_COLUMNS.map(([, prefix, key]) => `${prefix}_${toDbSettingKey(key)}`),
        ];
        await this.insert(client, 'guild_notification_settings', notificationColumns, [
            guildId,
            ...NOTIFICATION_COLUMNS.map(([section, , key]) => {
                const value =
                    instance.notificationSettings[section]?.[key] ?? this.notificationTemplate[section]?.[key] ?? null;
                return typeof value === 'boolean' ? dbBool(value) : value;
            }),
        ]);
    }

    private async readSettings(guildId: string, instance: Instance): Promise<void> {
        const general = (await this.rows('SELECT * FROM guild_general_settings WHERE guild_id = ?', [guildId]))[0];
        for (const [key, column] of GENERAL_COLUMNS) {
            const templateValue = this.generalTemplate[key];
            instance.generalSettings[key] =
                typeof templateValue === 'boolean' ? fromDbBool(general[column]) : (general[column] ?? templateValue);
        }

        const notification = (
            await this.rows('SELECT * FROM guild_notification_settings WHERE guild_id = ?', [guildId])
        )[0];
        for (const [section, prefix, key] of NOTIFICATION_COLUMNS) {
            if (!(section in instance.notificationSettings)) instance.notificationSettings[section] = {};
            const templateValue = this.notificationTemplate[section]?.[key];
            const value = notification[`${prefix}_${toDbSettingKey(key)}`];
            instance.notificationSettings[section][key] =
                typeof templateValue === 'boolean' ? fromDbBool(value) : (value ?? templateValue);
        }
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

    private async readServers(guildId: string, instance: Instance): Promise<void> {
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

    private async readGuildCollections(guildId: string, instance: Instance): Promise<void> {
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

    private enqueueWrite(callback: () => Promise<unknown>): void {
        const write = this.writeQueue.then(callback);
        this.writeQueue = write.catch((error) => {
            this.writeError = error;
        });
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

function toDbSettingKey(key: string): string {
    return key === 'inGame' ? 'in_game' : key;
}
