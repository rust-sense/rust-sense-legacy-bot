import Fs from 'fs';
import Path from 'path';
import { fileURLToPath } from 'url';

let DatabaseSync: typeof import('node:sqlite').DatabaseSync | null = null;
try {
    ({ DatabaseSync } = await import('node:sqlite'));
} catch (_e) {
    /* node:sqlite unavailable in this runtime. */
}

const SQLITE_SCHEMA_VERSION = '2';
const SQLITE_DATABASE_FILE = 'staticData.sqlite';
const DEFAULT_DATA_DIRECTORY = 'data';
const DEFAULT_JSON_SOURCE_DIRECTORY = 'static-json';

const META_TABLE = 'static_files_meta';
const DATA_TABLE = 'static_files_data';

interface DatasetConfigEntry {
    file: string;
    grouped?: boolean;
    groups?: string[];
}

const DATASET_CONFIG: Record<string, DatasetConfigEntry> = {
    actors: { file: 'actors.json' },
    cctv: { file: 'cctv.json' },
    htmlReservedSymbols: { file: 'htmlReservedSymbols.json' },
    items: { file: 'items.json' },
    RandomUsernames: { file: 'RandomUsernames.json' },
    rustlabsBuildingBlocks: { file: 'rustlabsBuildingBlocks.json' },
    rustlabsOther: { file: 'rustlabsOther.json' },
    rustlabsCraftData: { file: 'rustlabsCraftData.json' },
    rustlabsResearchData: { file: 'rustlabsResearchData.json' },
    rustlabsRecycleData: { file: 'rustlabsRecycleData.json' },
    rustlabsDurabilityData: {
        file: 'rustlabsDurabilityData.json',
        grouped: true,
        groups: ['items', 'buildingBlocks', 'other'],
    },
    rustlabsSmeltingData: { file: 'rustlabsSmeltingData.json' },
    rustlabsDespawnData: { file: 'rustlabsDespawnData.json' },
    rustlabsStackData: { file: 'rustlabsStackData.json' },
    rustlabsDecayData: {
        file: 'rustlabsDecayData.json',
        grouped: true,
        groups: ['items', 'buildingBlocks', 'other'],
    },
    rustlabsUpkeepData: {
        file: 'rustlabsUpkeepData.json',
        grouped: true,
        groups: ['items', 'buildingBlocks', 'other'],
    },
};

interface RustlabsStaticStorageOptions {
    dataPath?: string;
    sourceDirectory?: string;
    sqlitePath?: string;
}

interface BuildDatabaseOptions {
    dataPath?: string;
    sourceDirectory?: string;
    databasePath?: string;
}

interface BuildResult {
    schemaVersion: string;
    sourceDirectory: string;
    databasePath: string;
    totalRows: number;
    datasetRows: Record<string, number>;
}

interface Statements {
    getKeys: ReturnType<import('node:sqlite').DatabaseSync['prepare']>;
    hasEntry: ReturnType<import('node:sqlite').DatabaseSync['prepare']>;
    getEntry: ReturnType<import('node:sqlite').DatabaseSync['prepare']>;
    getDatasetEntries: ReturnType<import('node:sqlite').DatabaseSync['prepare']>;
}

export default class RustlabsStaticStorage {
    private dataPath: string;
    private sourceDirectory: string;
    private sqlitePath: string;
    private db: import('node:sqlite').DatabaseSync | null = null;
    private statements: Statements | null = null;
    private datasetCache = new Map<string, unknown>();

    constructor(options: RustlabsStaticStorageOptions = {}) {
        this.dataPath = options.dataPath ?? RustlabsStaticStorage.getDefaultDataPath();
        this.sourceDirectory = options.sourceDirectory ?? RustlabsStaticStorage.getDefaultJsonSourcePath(this.dataPath);
        this.sqlitePath = options.sqlitePath ?? RustlabsStaticStorage.getDefaultSqlitePath(this.dataPath);

        if (DatabaseSync === null) {
            throw new Error('node:sqlite is unavailable. Use Node.js 22+ or install a SQLite driver for this project.');
        }

        if (!Fs.existsSync(this.sqlitePath)) {
            throw new Error(`Static SQLite database missing at "${this.sqlitePath}". Run "npm run build:static-db".`);
        }

        this.db = new DatabaseSync(this.sqlitePath);
        this.validateSchema();
        this.prepareStatements();
    }

    static getProjectRootPath(): string {
        const __dirname = Path.dirname(fileURLToPath(import.meta.url));
        return Path.join(__dirname, '..', '..');
    }

    static getDefaultDataPath(): string {
        return Path.join(RustlabsStaticStorage.getProjectRootPath(), DEFAULT_DATA_DIRECTORY);
    }

    static getDefaultJsonSourcePath(dataPath = RustlabsStaticStorage.getDefaultDataPath()): string {
        return Path.join(dataPath, DEFAULT_JSON_SOURCE_DIRECTORY);
    }

    static getDefaultSqlitePath(dataPath = RustlabsStaticStorage.getDefaultDataPath()): string {
        return Path.join(dataPath, SQLITE_DATABASE_FILE);
    }

    /* Backward compatible alias used in earlier refactor. */
    static getDefaultStaticFilesPath(): string {
        return RustlabsStaticStorage.getDefaultJsonSourcePath();
    }

    static getDatasetConfig(): Record<string, DatasetConfigEntry> {
        return DATASET_CONFIG;
    }

    static buildDatabaseFromJsonFiles(options: BuildDatabaseOptions = {}): BuildResult {
        if (DatabaseSync === null) {
            throw new Error('node:sqlite is unavailable. Use Node.js 22+ to build the static database.');
        }

        const dataPath = options.dataPath ?? RustlabsStaticStorage.getDefaultDataPath();
        const sourceDirectory = options.sourceDirectory ?? RustlabsStaticStorage.getDefaultJsonSourcePath(dataPath);
        const databasePath = options.databasePath ?? RustlabsStaticStorage.getDefaultSqlitePath(dataPath);

        const missingFiles: string[] = [];
        for (const { file } of Object.values(DATASET_CONFIG)) {
            const jsonPath = Path.join(sourceDirectory, file);
            if (!Fs.existsSync(jsonPath)) missingFiles.push(jsonPath);
        }
        if (missingFiles.length > 0) {
            throw new Error(`Missing source JSON files for static DB build:\n${missingFiles.join('\n')}`);
        }

        const databaseDirectory = Path.dirname(databasePath);
        if (!Fs.existsSync(databaseDirectory)) {
            Fs.mkdirSync(databaseDirectory, { recursive: true });
        }

        const db = new DatabaseSync(databasePath);
        let totalRows = 0;
        const datasetRows: Record<string, number> = {};
        try {
            db.exec(`
                CREATE TABLE IF NOT EXISTS ${META_TABLE} (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ${DATA_TABLE} (
                    dataset TEXT NOT NULL,
                    group_name TEXT NOT NULL,
                    data_key TEXT NOT NULL,
                    json_value TEXT NOT NULL,
                    PRIMARY KEY (dataset, group_name, data_key)
                );
            `);

            const clearDataStatement = db.prepare(`DELETE FROM ${DATA_TABLE}`);
            const clearMetaStatement = db.prepare(`DELETE FROM ${META_TABLE}`);
            const insertDataStatement = db.prepare(`
                INSERT INTO ${DATA_TABLE} (dataset, group_name, data_key, json_value)
                VALUES (?, ?, ?, ?)
            `);
            const insertMetaStatement = db.prepare(`
                INSERT INTO ${META_TABLE} (key, value)
                VALUES (?, ?)
            `);

            db.exec('BEGIN IMMEDIATE TRANSACTION');

            clearDataStatement.run();
            clearMetaStatement.run();

            for (const [dataset, config] of Object.entries(DATASET_CONFIG)) {
                const jsonPath = Path.join(sourceDirectory, config.file);
                const jsonData = JSON.parse(Fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;

                let rowCount = 0;
                if (config.grouped && config.groups) {
                    for (const groupName of config.groups) {
                        const groupData =
                            Object.prototype.hasOwnProperty.call(jsonData, groupName) && jsonData[groupName] !== null
                                ? (jsonData[groupName] as Record<string, unknown>)
                                : {};

                        for (const [dataKey, value] of Object.entries(groupData)) {
                            insertDataStatement.run(dataset, groupName, dataKey, JSON.stringify(value));
                            rowCount += 1;
                            totalRows += 1;
                        }
                    }
                } else {
                    for (const [dataKey, value] of Object.entries(jsonData)) {
                        insertDataStatement.run(dataset, '', dataKey, JSON.stringify(value));
                        rowCount += 1;
                        totalRows += 1;
                    }
                }

                datasetRows[dataset] = rowCount;
            }

            insertMetaStatement.run('schemaVersion', SQLITE_SCHEMA_VERSION);
            insertMetaStatement.run('generatedAt', new Date().toISOString());
            insertMetaStatement.run('sourceDirectory', sourceDirectory);

            db.exec('COMMIT');
        } catch (e) {
            try {
                db.exec('ROLLBACK');
            } catch (_rollbackError) {
                /* Ignore rollback errors and throw original exception. */
            }
            throw e;
        } finally {
            db.close();
        }

        return {
            schemaVersion: SQLITE_SCHEMA_VERSION,
            sourceDirectory,
            databasePath,
            totalRows,
            datasetRows,
        };
    }

    close(): void {
        if (this.db !== null) {
            this.db.close();
            this.db = null;
        }
    }

    isUsingSqlite(): boolean {
        return true;
    }

    getKeys(dataset: string, group = ''): string[] {
        const config = this.getConfig(dataset);
        const normalizedGroup = this.normalizeGroup(config, group);

        return (this.statements?.getKeys.all(dataset, normalizedGroup) as { data_key: string }[]).map(
            (row) => row.data_key,
        );
    }

    hasEntry(dataset: string, key: string | number, group = ''): boolean {
        const config = this.getConfig(dataset);
        const normalizedGroup = this.normalizeGroup(config, group);
        const normalizedKey = this.normalizeKey(key);

        return (
            (this.statements?.hasEntry.get(dataset, normalizedGroup, normalizedKey) as
                | { found: number }
                | undefined) !== undefined
        );
    }

    getEntry(dataset: string, key: string | number, group = ''): unknown | null {
        const config = this.getConfig(dataset);
        const normalizedGroup = this.normalizeGroup(config, group);
        const normalizedKey = this.normalizeKey(key);

        const row = this.statements?.getEntry.get(dataset, normalizedGroup, normalizedKey) as
            | { json_value: string }
            | undefined;
        if (row === undefined) return null;
        return JSON.parse(row.json_value);
    }

    getDatasetObject(dataset: string, group = ''): Record<string, unknown> {
        const config = this.getConfig(dataset);
        const normalizedGroup = this.normalizeGroup(config, group);
        const cacheKey = this.getCacheKey(dataset, normalizedGroup);

        if (this.datasetCache.has(cacheKey)) {
            return this.datasetCache.get(cacheKey) as Record<string, unknown>;
        }

        const rows = this.statements?.getDatasetEntries.all(dataset, normalizedGroup) as {
            data_key: string;
            json_value: string;
        }[];
        const objectData: Record<string, unknown> = {};
        for (const row of rows) {
            objectData[row.data_key] = JSON.parse(row.json_value);
        }

        this.datasetCache.set(cacheKey, objectData);
        return objectData;
    }

    private validateSchema(): void {
        if (!this.db) return;
        const metaTable = this.db
            .prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
        `)
            .get(META_TABLE) as { name: string } | undefined;
        const dataTable = this.db
            .prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
        `)
            .get(DATA_TABLE) as { name: string } | undefined;

        if (!metaTable || !dataTable) {
            throw new Error(
                `Static SQLite database at "${this.sqlitePath}" is missing required tables. ` +
                    'Run "npm run build:static-db".',
            );
        }

        const schemaVersionRow = this.db
            .prepare(`
            SELECT value
            FROM ${META_TABLE}
            WHERE key = 'schemaVersion'
        `)
            .get() as { value: string } | undefined;

        if (!schemaVersionRow || schemaVersionRow.value !== SQLITE_SCHEMA_VERSION) {
            throw new Error(
                `Static SQLite database schema mismatch (expected ${SQLITE_SCHEMA_VERSION}, got ` +
                    `${schemaVersionRow ? schemaVersionRow.value : 'missing'}). Run "npm run build:static-db".`,
            );
        }
    }

    private prepareStatements(): void {
        if (!this.db) return;
        this.statements = {
            getKeys: this.db.prepare(`
                SELECT data_key
                FROM ${DATA_TABLE}
                WHERE dataset = ? AND group_name = ?
                ORDER BY data_key
            `),
            hasEntry: this.db.prepare(`
                SELECT 1 AS found
                FROM ${DATA_TABLE}
                WHERE dataset = ? AND group_name = ? AND data_key = ?
                LIMIT 1
            `),
            getEntry: this.db.prepare(`
                SELECT json_value
                FROM ${DATA_TABLE}
                WHERE dataset = ? AND group_name = ? AND data_key = ?
            `),
            getDatasetEntries: this.db.prepare(`
                SELECT data_key, json_value
                FROM ${DATA_TABLE}
                WHERE dataset = ? AND group_name = ?
                ORDER BY data_key
            `),
        };
    }

    private getCacheKey(dataset: string, group: string): string {
        return `${dataset}|${group}`;
    }

    private getConfig(dataset: string): DatasetConfigEntry {
        if (!Object.prototype.hasOwnProperty.call(DATASET_CONFIG, dataset)) {
            throw new Error(`Unknown dataset: ${dataset}`);
        }
        const config = DATASET_CONFIG[dataset];
        if (!config) {
            throw new Error(`Unknown dataset: ${dataset}`);
        }
        return config;
    }

    private normalizeGroup(config: DatasetConfigEntry, group: string): string {
        if (!config.grouped) return '';

        if (typeof group !== 'string' || !config.groups?.includes(group)) {
            throw new Error(`Invalid grouped dataset key: ${group}`);
        }

        return group;
    }

    private normalizeKey(key: string | number): string {
        if (typeof key === 'string') return key;
        return `${key}`;
    }
}
