import config from '../config.js';
import { GuildStateCache } from './GuildStateCache.js';
import { JsonAdapter } from './JsonAdapter.js';
import { PostgresAdapter } from './PostgresAdapter.js';
import { SqliteAdapter } from './SqliteAdapter.js';
import type { PersistenceAdapter, PersistenceAdapterName } from './types.js';

let adapter: PersistenceAdapter | null = null;
let cache: GuildStateCache | null = null;

export function createPersistenceAdapter(): PersistenceAdapter {
    const adapterName = config.persistence.adapter;
    if (adapterName === 'json') return new JsonAdapter();
    if (adapterName === 'sqlite') return new SqliteAdapter(config.persistence.sqlitePath);
    if (adapterName === 'postgres') {
        if (!config.persistence.postgresUrl) {
            throw new Error('RPP_POSTGRES_URL is required when RPP_PERSISTENCE_ADAPTER=postgres');
        }
        return new PostgresAdapter(config.persistence.postgresUrl);
    }

    throw new Error(`Unsupported persistence adapter: ${adapterName satisfies never}`);
}

export async function initPersistence(): Promise<void> {
    adapter = createPersistenceAdapter();
    await adapter.init();
    cache = new GuildStateCache(adapter);
}

export function getPersistenceCache(): GuildStateCache {
    if (!cache) {
        throw new Error('Persistence has not been initialized');
    }

    return cache;
}

export function getPersistenceAdapterName(): PersistenceAdapterName {
    return adapter?.name ?? config.persistence.adapter;
}
