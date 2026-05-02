import config from '../config.js';
import { JsonAdapter } from './JsonAdapter.js';
import { PersistenceService } from './PersistenceService.js';
import { PostgresAdapter } from './PostgresAdapter.js';
import { SqliteAdapter } from './SqliteAdapter.js';
import type { PersistenceAdapter, PersistenceAdapterName } from './types.js';

let adapter: PersistenceAdapter | null = null;
let service: PersistenceService | null = null;

export function createPersistenceAdapter(): PersistenceAdapter {
    const adapterName = config.persistence.adapter;
    if (adapterName === 'json') return new JsonAdapter();
    if (adapterName === 'sqlite')
        return new SqliteAdapter(config.persistence.sqlitePath, config.persistence.migrateLegacyJson);
    if (adapterName === 'postgres') {
        if (!config.persistence.postgresUrl) {
            throw new Error('RPP_POSTGRES_URL is required when RPP_PERSISTENCE_ADAPTER=postgres');
        }
        return new PostgresAdapter(config.persistence.postgresUrl, config.persistence.migrateLegacyJson);
    }

    throw new Error(`Unsupported persistence adapter: ${adapterName satisfies never}`);
}

export async function initPersistence(): Promise<void> {
    adapter = createPersistenceAdapter();
    await adapter.init();
    service = new PersistenceService(adapter);
}

export function getPersistenceService(): PersistenceService {
    if (!service) {
        throw new Error('Persistence has not been initialized');
    }

    return service;
}

export function getPersistenceCache(): PersistenceService {
    return getPersistenceService();
}

export function isPersistenceInitialized(): boolean {
    return service !== null;
}

export function getPersistenceAdapterName(): PersistenceAdapterName {
    return adapter?.name ?? config.persistence.adapter;
}

export async function closePersistence(): Promise<void> {
    await service?.flush();
    await adapter?.close();
    service = null;
    adapter = null;
}
