import { Pool, type PoolClient } from 'pg';
import { buildDefaultGeneralSettings, buildDefaultNotificationSettings } from '../domain/guildSettings.js';
import { addServerLite, createEmptyInstance } from '../domain/guildState.js';
import type { Credentials, Instance, Server } from '../types/instance.js';
import {
    applyPersistedGuildSetting,
    PERSISTED_GUILD_SETTING_DEFINITIONS,
    readGuildSettingValue,
    serializeGuildSettingValue,
} from './guildSettingsRegistry.js';
import { JsonAdapter } from './JsonAdapter.js';
import { migrateFromJsonAdapter } from './jsonMigration.js';
import {
    CHANNEL_ID_KEYS,
    credentialEntries,
    dbBool,
    fromDbBool,
    INFORMATION_MESSAGE_ID_KEYS,
    normalizeTracker,
} from './relational/mapping.js';
import type {
    GuildCollectionsState,
    GuildCoreState,
    GuildSettingsState,
    GuildStateDomain,
    PersistenceAdapter,
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
        if (this.migrateLegacyJsonOnInit) await this.migrateLegacyJson();
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

    async readServers(guildId: string): Promise<Record<string, Server>> {
        const instance = createEmptyInstance();
        await this.hydrateServers(guildId, instance);
        return instance.serverList;
    }

    async replaceServers(guildId: string, servers: Record<string, Server>): Promise<void> {
        await this.withTransaction(async (client) => {
            await this.run(client, 'DELETE FROM servers WHERE guild_id = ?', [guildId]);
            await this.writeServers(client, guildId, { serverList: servers } as Instance);
        });
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

    async writeGuildDomains(guildId: string, instance: Instance, domains: GuildStateDomain[]): Promise<void> {
        await this.withTransaction(async (client) => {
            if (domains.includes('core')) {
                await this.writeGuild(client, guildId, instance);
            }
            if (domains.includes('settings')) {
                await this.run(client, 'DELETE FROM guild_settings WHERE guild_id = ?', [guildId]);
                await this.writeSettings(client, guildId, instance);
            }
            if (domains.includes('servers')) {
                await this.run(client, 'DELETE FROM servers WHERE guild_id = ?', [guildId]);
                await this.writeServers(client, guildId, instance);
            }
            if (domains.includes('collections')) {
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
                await this.writeGuildCollections(client, guildId, instance);
            }
        });
    }

    async flush(): Promise<void> {}

    private database(): Pool {
        if (!this.pool) throw new Error('Postgres persistence adapter has not been initialized');
        return this.pool;
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
        if (status === 'completed') return;
        if (status === 'in_progress') {
            throw new Error(
                'Legacy JSON migration is marked in_progress. Inspect persistence state before restarting.',
            );
        }

        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_status', 'in_progress', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
        );
        let manifest: { guildCount: number; checksum: string };
        try {
            manifest = await migrateFromJsonAdapter(new JsonAdapter(), this);
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
            [String(manifest.guildCount)],
        );
        await this.run(
            this.database(),
            "INSERT INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_source_checksum', ?, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
            [manifest.checksum],
        );
    }

    private async writeInstanceAsync(guildId: string, instance: Instance): Promise<void> {
        const existingCredentials = await this.readCredentialsFromDatabase(guildId);
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
