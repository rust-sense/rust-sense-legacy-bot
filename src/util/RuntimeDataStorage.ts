import Fs from 'fs';
import Path from 'path';
import { fileURLToPath } from 'url';

let DatabaseSync: typeof import('node:sqlite').DatabaseSync | null = null;
try {
    ({ DatabaseSync } = await import('node:sqlite'));
} catch (_e) {
    /* node:sqlite unavailable in this runtime. */
}

const DATABASE_FILE_NAME = 'runtimeData.sqlite';
const TABLE_NAME = 'runtime_server_state';

interface RuntimeDataStorageOptions {
    dataPath?: string;
    databasePath?: string;
}

interface Statements {
    getServerState: ReturnType<import('node:sqlite').DatabaseSync['prepare']>;
    upsertServerState: ReturnType<import('node:sqlite').DatabaseSync['prepare']>;
    deleteServerState: ReturnType<import('node:sqlite').DatabaseSync['prepare']>;
}

export default class RuntimeDataStorage {
    private dataPath: string;
    private databasePath: string;
    private db: import('node:sqlite').DatabaseSync | null = null;
    private statements: Statements | null = null;

    constructor(options: RuntimeDataStorageOptions = {}) {
        const __dirname = Path.dirname(fileURLToPath(import.meta.url));
        this.dataPath = options.dataPath ?? Path.join(__dirname, '..', '..', 'data');
        this.databasePath = options.databasePath ?? Path.join(this.dataPath, DATABASE_FILE_NAME);

        if (DatabaseSync === null) {
            throw new Error(
                'node:sqlite is unavailable. Runtime data persistence requires Node.js 22+ in this build.'
            );
        }

        if (!Fs.existsSync(this.dataPath)) {
            Fs.mkdirSync(this.dataPath, { recursive: true });
        }

        this.db = new DatabaseSync(this.databasePath);
        this.prepareDatabase();
        this.prepareStatements();
    }

    close(): void {
        if (this.db !== null) {
            this.db.close();
            this.db = null;
        }
    }

    getServerState(guildId: string, serverId: string, stateKey: string): unknown | null {
        if (!this.statements) return null;
        const row = this.statements.getServerState.get(
            this.normalize(guildId),
            this.normalize(serverId),
            this.normalize(stateKey)
        ) as { value_json: string } | undefined;
        if (row === undefined) return null;

        try {
            return JSON.parse(row.value_json);
        } catch (_e) {
            return null;
        }
    }

    setServerState(guildId: string, serverId: string, stateKey: string, value: unknown): void {
        if (!this.statements) return;
        this.statements.upsertServerState.run(
            this.normalize(guildId),
            this.normalize(serverId),
            this.normalize(stateKey),
            JSON.stringify(value),
            Date.now()
        );
    }

    deleteServerState(guildId: string, serverId: string, stateKey: string): void {
        if (!this.statements) return;
        this.statements.deleteServerState.run(
            this.normalize(guildId),
            this.normalize(serverId),
            this.normalize(stateKey)
        );
    }

    private prepareDatabase(): void {
        if (!this.db) return;
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                guild_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                state_key TEXT NOT NULL,
                value_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (guild_id, server_id, state_key)
            );
        `);
    }

    private prepareStatements(): void {
        if (!this.db) return;
        this.statements = {
            getServerState: this.db.prepare(`
                SELECT value_json
                FROM ${TABLE_NAME}
                WHERE guild_id = ? AND server_id = ? AND state_key = ?
            `),
            upsertServerState: this.db.prepare(`
                INSERT INTO ${TABLE_NAME} (guild_id, server_id, state_key, value_json, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, server_id, state_key)
                DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
            `),
            deleteServerState: this.db.prepare(`
                DELETE FROM ${TABLE_NAME}
                WHERE guild_id = ? AND server_id = ? AND state_key = ?
            `),
        };
    }

    private normalize(value: string | number): string {
        if (typeof value === 'string') return value;
        return `${value}`;
    }
}
