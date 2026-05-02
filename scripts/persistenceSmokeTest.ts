import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PersistenceService } from '../src/persistence/PersistenceService.js';
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
    const service = new PersistenceService(adapter);
    const instanceState = instanceToCompatibilityState(buildInstance());
    await adapter.writeGuildCore('guild-smoke', instanceState);
    await adapter.writeGuildSettings('guild-smoke', instanceState);
    await adapter.replaceServers('guild-smoke', instanceState.serverList);
    await adapter.replaceGuildCollections('guild-smoke', instanceState);
    await adapter.writeCredentials('guild-smoke', buildCredentials());
    await adapter.flush();
    const roundTripped = createEmptyInstance(
        (await adapter.readGuildSettings('guild-smoke')).generalSettings,
        (await adapter.readGuildSettings('guild-smoke')).notificationSettings,
    );
    Object.assign(roundTripped, await adapter.readGuildCore('guild-smoke'));
    roundTripped.serverList = await adapter.readServers('guild-smoke');
    Object.assign(roundTripped, await adapter.readGuildCollections('guild-smoke'));
    assertRoundTrip(roundTripped, await adapter.readCredentials('guild-smoke'));
    assertRoundTrip(await service.readGuildState('guild-smoke'), await service.getCredentials('guild-smoke'));
    await adapter.close();
}

async function sqliteRollbackSmoke(): Promise<void> {
    const root = prepareTempCwd('rpp-sqlite-rollback-smoke-');
    const databasePath = path.join(root, 'data', 'state.sqlite');
    migrateSqlite(databasePath);
    const originalCwd = process.cwd();
    process.chdir(root);
    try {
        const adapter = new SqliteAdapter(databasePath);
        await adapter.init();
        const state = instanceToCompatibilityState(buildInstance());
        await adapter.writeGuildCore('guild-rollback', state);
        await adapter.writeGuildSettings('guild-rollback', state);
        await adapter.replaceServers('guild-rollback', state.serverList);

        const brokenServers = structuredClone(state.serverList);
        brokenServers['server-1'].switches[123] = {
            ...brokenServers['server-1'].switches[7],
            id: 123,
            name: null as unknown as string,
        };

        assert.throws(() => adapter.replaceServers('guild-rollback', brokenServers));
        assert.equal((await adapter.readServers('guild-rollback'))['server-1'].switches[7].name, 'Switch');
        assert.equal((await adapter.readServers('guild-rollback'))['server-1'].switches[123], undefined);
        await adapter.close();
    } finally {
        process.chdir(originalCwd);
    }
}

async function sqliteFullGuildRollbackSmoke(): Promise<void> {
    const root = prepareTempCwd('rpp-sqlite-full-guild-rollback-smoke-');
    const databasePath = path.join(root, 'data', 'state.sqlite');
    migrateSqlite(databasePath);
    const originalCwd = process.cwd();
    process.chdir(root);
    try {
        const adapter = new SqliteAdapter(databasePath);
        await adapter.init();
        const service = new PersistenceService(adapter);
        const original = buildInstance();
        await service.saveGuildStateChanges('guild-full-rollback', original);

        const broken = structuredClone(original);
        broken.role = 'changed-before-failure';
        broken.serverList['server-1'].switches[123] = {
            ...broken.serverList['server-1'].switches[7],
            id: 123,
            name: null as unknown as string,
        };

        await assert.rejects(() => service.saveGuildStateChanges('guild-full-rollback', broken));
        const roundTripped = await service.readGuildState('guild-full-rollback');
        assert.equal(roundTripped.role, 'role-id');
        assert.equal(roundTripped.serverList['server-1'].switches[7].name, 'Switch');
        assert.equal(roundTripped.serverList['server-1'].switches[123], undefined);
        await adapter.close();
    } finally {
        process.chdir(originalCwd);
    }
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
        const settings = await adapter.readGuildSettings('guild-legacy');
        const instance = createEmptyInstance(settings.generalSettings, settings.notificationSettings);
        Object.assign(instance, await adapter.readGuildCore('guild-legacy'));
        instance.serverList = await adapter.readServers('guild-legacy');
        Object.assign(instance, await adapter.readGuildCollections('guild-legacy'));
        assertRoundTrip(instance, await adapter.readCredentials('guild-legacy'));
        await adapter.close();

        const secondAdapter = new SqliteAdapter(databasePath);
        await secondAdapter.init();
        const secondSettings = await secondAdapter.readGuildSettings('guild-legacy');
        const secondInstance = createEmptyInstance(secondSettings.generalSettings, secondSettings.notificationSettings);
        Object.assign(secondInstance, await secondAdapter.readGuildCore('guild-legacy'));
        secondInstance.serverList = await secondAdapter.readServers('guild-legacy');
        Object.assign(secondInstance, await secondAdapter.readGuildCollections('guild-legacy'));
        assertRoundTrip(secondInstance, await secondAdapter.readCredentials('guild-legacy'));
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

async function postgresLegacyMigrationSmoke(): Promise<void> {
    const postgresUrl = process.env.RPP_TEST_POSTGRES_MIGRATION_URL;
    if (!postgresUrl) return;

    const root = prepareTempCwd('rpp-postgres-legacy-smoke-');
    fs.writeFileSync(path.join(root, 'instances', 'guild-legacy.json'), JSON.stringify(buildInstance(), null, 2));
    fs.writeFileSync(path.join(root, 'credentials', 'guild-legacy.json'), JSON.stringify(buildCredentials(), null, 2));
    migratePostgres(postgresUrl);

    const originalCwd = process.cwd();
    process.chdir(root);
    try {
        const adapter = new PostgresAdapter(postgresUrl);
        await adapter.init();
        const settings = await adapter.readGuildSettings('guild-legacy');
        const instance = createEmptyInstance(settings.generalSettings, settings.notificationSettings);
        Object.assign(instance, await adapter.readGuildCore('guild-legacy'));
        instance.serverList = await adapter.readServers('guild-legacy');
        Object.assign(instance, await adapter.readGuildCollections('guild-legacy'));
        assertRoundTrip(instance, await adapter.readCredentials('guild-legacy'));
        await adapter.close();

        // Second init should skip migration (already completed) and still read back the same data
        const secondAdapter = new PostgresAdapter(postgresUrl);
        await secondAdapter.init();
        const secondSettings = await secondAdapter.readGuildSettings('guild-legacy');
        const secondInstance = createEmptyInstance(secondSettings.generalSettings, secondSettings.notificationSettings);
        Object.assign(secondInstance, await secondAdapter.readGuildCore('guild-legacy'));
        secondInstance.serverList = await secondAdapter.readServers('guild-legacy');
        Object.assign(secondInstance, await secondAdapter.readGuildCollections('guild-legacy'));
        assertRoundTrip(secondInstance, await secondAdapter.readCredentials('guild-legacy'));
        await secondAdapter.close();
    } finally {
        process.chdir(originalCwd);
    }
}

await sqliteSmoke();
await sqliteRollbackSmoke();
await sqliteFullGuildRollbackSmoke();
await sqliteLegacyMigrationSmoke();
await postgresSmoke();
await postgresLegacyMigrationSmoke();
console.log('persistence smoke passed');
