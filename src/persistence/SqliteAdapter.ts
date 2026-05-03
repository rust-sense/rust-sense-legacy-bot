import fs from 'node:fs';
import Database from 'better-sqlite3';
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
            console.info(
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

    readServers(guildId: string): Record<string, Server> {
        const instance = createEmptyInstance();
        this.hydrateServers(this.database(), guildId, instance);
        return instance.serverList;
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

    writeGuildDomains(guildId: string, instance: Instance, domains: GuildStateDomain[]): void {
        this.withTransaction(() => {
            const db = this.database();
            if (domains.includes('core')) {
                this.writeGuild(guildId, instance);
            }
            if (domains.includes('settings')) {
                db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(guildId);
                this.writeSettings(guildId, instance);
            }
            if (domains.includes('servers')) {
                db.prepare('DELETE FROM servers WHERE guild_id = ?').run(guildId);
                this.insertServers(guildId, instance);
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
                    db.prepare(`DELETE FROM ${table} WHERE guild_id = ?`).run(guildId);
                }
                this.insertGuildCollections(guildId, instance);
            }
        });
    }

    async flush(): Promise<void> {}

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
            console.info(
                `[persistence] Legacy JSON migration already completed for SQLite; skipping. ` +
                    `Recorded source guilds=${migratedGuildCount}, recorded checksum=${migratedChecksum}, ` +
                    `current source guilds=${manifest.guildCount}, current checksum=${manifest.checksum}.`,
            );
            if (migratedChecksum !== 'unknown' && migratedChecksum !== manifest.checksum) {
                console.warn(
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
            console.warn(
                `[persistence] Legacy JSON migration has unexpected SQLite status '${status}'. ` +
                    'The adapter will attempt a new migration and overwrite that status.',
            );
        }

        console.info(
            `[persistence] Starting one-time legacy JSON to SQLite migration. ` +
                `Target state key: _persistence_meta.legacy_json_migration_status. ` +
                `Source guilds=${manifest.guildCount}, source checksum=${manifest.checksum}.`,
        );
        db.prepare(
            "INSERT OR REPLACE INTO _persistence_meta (key, value, updated_at) VALUES ('legacy_json_migration_status', 'in_progress', CURRENT_TIMESTAMP)",
        ).run();
        let migratedManifest: { guildCount: number; checksum: string };
        try {
            migratedManifest = await migrateFromJsonAdapter(source, this);
        } catch (error) {
            console.error(
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
        console.info(
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
