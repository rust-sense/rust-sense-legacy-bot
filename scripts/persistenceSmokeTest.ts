import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PostgresAdapter } from '../src/persistence/PostgresAdapter.js';
import { createEmptyInstance } from '../src/persistence/relationalMapping.js';
import { SqliteAdapter } from '../src/persistence/SqliteAdapter.js';
import { instanceToCompatibilityState, type PersistenceAdapter } from '../src/persistence/types.js';
import type { Credentials, Instance } from '../src/types/instance.js';
import { loadJsonResourceSync } from '../src/utils/filesystemUtils.js';

const repoRoot = process.cwd();

function prepareTempCwd(prefix: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    fs.mkdirSync(path.join(root, 'instances'), { recursive: true });
    fs.mkdirSync(path.join(root, 'credentials'), { recursive: true });
    fs.symlinkSync(path.join(repoRoot, 'resources'), path.join(root, 'resources'), 'dir');
    return root;
}

function runDbmate(args: string[]): void {
    execFileSync('pnpm', ['exec', 'dbmate', ...args], {
        cwd: repoRoot,
        stdio: 'pipe',
    });
}

function migrateSqlite(databasePath: string): void {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    runDbmate([
        '--url',
        `sqlite3:${databasePath}`,
        '--migrations-dir',
        path.join(repoRoot, 'db', 'migrations', 'sqlite'),
        '--schema-file',
        path.join(os.tmpdir(), `rust-sense-smoke-${process.pid}.sql`),
        'up',
    ]);
}

function migratePostgres(postgresUrl: string): void {
    runDbmate([
        '--url',
        postgresUrl,
        '--migrations-dir',
        path.join(repoRoot, 'db', 'migrations', 'postgresql'),
        '--schema-file',
        path.join(os.tmpdir(), `rust-sense-smoke-pg-${process.pid}.sql`),
        'up',
    ]);
}

function buildInstance(): Instance {
    const generalSettings = loadJsonResourceSync<Instance['generalSettings']>('templates/generalSettingsTemplate.json');
    const notificationSettings = loadJsonResourceSync<Instance['notificationSettings']>(
        'templates/notificationSettingsTemplate.json',
    );
    const instance = createEmptyInstance(generalSettings, notificationSettings);
    instance.firstTime = false;
    instance.role = 'role-id';
    instance.adminRole = 'admin-role-id';
    instance.activeServer = 'server-1';
    instance.marketSubscriptionList.all.push('rifle.ak');
    instance.marketBlacklist.push('stones');
    instance.blacklist.discordIds.push('discord-blocked');
    instance.blacklist.steamIds.push('steam-blocked');
    instance.whitelist.steamIds.push('steam-allowed');
    instance.aliases.push({ index: 1, alias: 'ak', value: 'rifle.ak' });
    instance.customIntlMessages.greeting = 'Hello {name}';
    instance.teamChatColors['765'] = '#ffffff';
    instance.trackers['99'] = {
        id: 99,
        name: 'Tracker',
        battlemetricsId: 'bm',
        status: true,
        lastScreenshot: null,
        lastOnline: 'online',
        lastWipe: 'wipe',
        messageId: 'tracker-message',
        clanTag: 'TAG',
        everyone: true,
        inGame: false,
        players: [{ name: 'Player', steamId: '765', playerId: 'player-id' }],
    };
    instance.serverList['server-1'] = {
        serverId: 'server-1',
        title: 'Smoke Server',
        serverIp: '127.0.0.1',
        appPort: 28082,
        steamId: '765',
        playerToken: 'player-token',
        battlemetricsId: 'bm-server',
        switches: {
            7: {
                id: 7,
                name: 'Switch',
                active: true,
                reachable: true,
                location: 'A1',
                x: 1,
                y: 2,
                image: null,
                command: 'switch',
                autoDayNightOnOff: 0,
                proximity: 10,
                messageId: 'switch-message',
                everyone: true,
            },
        },
        alarms: {
            8: {
                id: 8,
                name: 'Alarm',
                active: false,
                reachable: true,
                location: 'B2',
                x: 3,
                y: 4,
                image: null,
                message: 'alarm',
                command: 'alarm',
                lastTrigger: 123,
                inGame: true,
                messageId: 'alarm-message',
                everyone: false,
            },
        },
        storageMonitors: {
            9: {
                id: 9,
                name: 'Box',
                type: 'largeWoodBox',
                image: null,
                reachable: true,
                location: 'C3',
                x: 5,
                y: 6,
                items: [{ itemId: 123, quantity: 456 }],
                capacity: 48,
                decaying: false,
                inGame: true,
                messageId: 'storage-message',
                everyone: true,
                upkeep: null,
            },
        },
        markers: {
            marker: { x: 7, y: 8, location: 'D4' },
        },
        switchGroups: {
            10: {
                id: 10,
                name: 'Group',
                switches: [7],
                active: true,
                image: null,
                command: 'group',
                serverId: 'server-1',
                messageId: 'group-message',
            },
        },
        customCameraGroups: {
            11: {
                id: 11,
                name: 'Cameras',
                cameras: ['CAM1'],
            },
        },
        notes: {
            12: 'note',
        },
        cargoShipEgressTimeMs: 1,
        oilRigLockedCrateUnlockTimeMs: 2,
        deepSeaMinWipeCooldownMs: 3,
        deepSeaMaxWipeCooldownMs: 4,
        deepSeaWipeDurationMs: 5,
        timeTillDay: { sample: 42 },
        timeTillNight: { sample: 84 },
        messageId: 'server-message',
        connect: 'client.connect 127.0.0.1',
        img: 'image',
        url: 'url',
        description: 'description',
    };

    return instance;
}

function buildCredentials(): Credentials {
    return {
        hoster: '765',
        765: {
            discord_user_id: 'discord-user',
            gcm: {
                androidId: 'android-id',
                securityToken: 'security-token',
            },
            issuedDate: 'issued',
            expireDate: 'expires',
        },
    } as Credentials;
}

function assertRoundTrip(instance: Instance, credentials: Credentials): void {
    assert.equal(instance.role, 'role-id');
    assert.equal(instance.serverList['server-1'].switches[7].name, 'Switch');
    assert.equal(instance.serverList['server-1'].alarms[8].message, 'alarm');
    assert.equal(instance.serverList['server-1'].storageMonitors[9].items[0]?.quantity, 456);
    assert.equal(instance.serverList['server-1'].switchGroups[10].switches[0], 7);
    assert.equal(instance.serverList['server-1'].customCameraGroups[11].cameras[0], 'CAM1');
    assert.equal(instance.serverList['server-1'].markers.marker.location, 'D4');
    assert.equal(instance.serverList['server-1'].notes[12], 'note');
    assert.equal(instance.trackers[99].players[0]?.steamId, '765');
    assert.equal(instance.marketSubscriptionList.all[0], 'rifle.ak');
    assert.equal(instance.aliases[0]?.alias, 'ak');
    assert.equal(credentials.hoster, '765');
    assert.equal((credentials as any)[765].gcm.securityToken, 'security-token');
}

async function adapterRoundTrip(adapter: PersistenceAdapter): Promise<void> {
    await adapter.init();
    const instanceState = instanceToCompatibilityState(buildInstance());
    adapter.writeGuildCore('guild-smoke', instanceState);
    adapter.writeGuildSettings('guild-smoke', instanceState);
    adapter.replaceServers('guild-smoke', instanceState.serverList);
    adapter.replaceGuildCollections('guild-smoke', instanceState);
    adapter.writeCredentials('guild-smoke', buildCredentials());
    await adapter.flush();
    const roundTripped = createEmptyInstance(
        adapter.readGuildSettings('guild-smoke').generalSettings,
        adapter.readGuildSettings('guild-smoke').notificationSettings,
    );
    Object.assign(roundTripped, adapter.readGuildCore('guild-smoke'));
    roundTripped.serverList = adapter.readServers('guild-smoke');
    Object.assign(roundTripped, adapter.readGuildCollections('guild-smoke'));
    assertRoundTrip(roundTripped, adapter.readCredentials('guild-smoke'));
    await adapter.close();
}

async function sqliteSmoke(): Promise<void> {
    const root = prepareTempCwd('rpp-sqlite-smoke-');
    const databasePath = path.join(root, 'data', 'state.sqlite');
    migrateSqlite(databasePath);
    const originalCwd = process.cwd();
    process.chdir(root);
    try {
        await adapterRoundTrip(new SqliteAdapter(databasePath));
    } finally {
        process.chdir(originalCwd);
    }
}

async function sqliteLegacyMigrationSmoke(): Promise<void> {
    const root = prepareTempCwd('rpp-sqlite-legacy-smoke-');
    fs.writeFileSync(path.join(root, 'instances', 'guild-legacy.json'), JSON.stringify(buildInstance(), null, 2));
    fs.writeFileSync(path.join(root, 'credentials', 'guild-legacy.json'), JSON.stringify(buildCredentials(), null, 2));
    const databasePath = path.join(root, 'data', 'state.sqlite');
    migrateSqlite(databasePath);

    const originalCwd = process.cwd();
    process.chdir(root);
    try {
        const adapter = new SqliteAdapter(databasePath);
        await adapter.init();
        const settings = adapter.readGuildSettings('guild-legacy');
        const instance = createEmptyInstance(settings.generalSettings, settings.notificationSettings);
        Object.assign(instance, adapter.readGuildCore('guild-legacy'));
        instance.serverList = adapter.readServers('guild-legacy');
        Object.assign(instance, adapter.readGuildCollections('guild-legacy'));
        assertRoundTrip(instance, adapter.readCredentials('guild-legacy'));
        await adapter.close();

        const secondAdapter = new SqliteAdapter(databasePath);
        await secondAdapter.init();
        const secondSettings = secondAdapter.readGuildSettings('guild-legacy');
        const secondInstance = createEmptyInstance(secondSettings.generalSettings, secondSettings.notificationSettings);
        Object.assign(secondInstance, secondAdapter.readGuildCore('guild-legacy'));
        secondInstance.serverList = secondAdapter.readServers('guild-legacy');
        Object.assign(secondInstance, secondAdapter.readGuildCollections('guild-legacy'));
        assertRoundTrip(secondInstance, secondAdapter.readCredentials('guild-legacy'));
        await secondAdapter.close();
    } finally {
        process.chdir(originalCwd);
    }
}

async function postgresSmoke(): Promise<void> {
    const postgresUrl = process.env.RPP_TEST_POSTGRES_URL;
    if (!postgresUrl) return;

    const root = prepareTempCwd('rpp-postgres-smoke-');
    migratePostgres(postgresUrl);
    const originalCwd = process.cwd();
    process.chdir(root);
    try {
        await adapterRoundTrip(new PostgresAdapter(postgresUrl));
    } finally {
        process.chdir(originalCwd);
    }
}

await sqliteSmoke();
await sqliteLegacyMigrationSmoke();
await postgresSmoke();
console.log('persistence smoke passed');
