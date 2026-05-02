import { getPersistenceCache, isPersistenceInitialized } from '../persistence/index.js';
import type { Credentials, Instance } from '../types/instance.js';
import { cwdPath, loadJsonSync, writeJsonSync } from '../utils/filesystemUtils.js';

export function readInstanceFile(guildId: string): Instance {
    if (isPersistenceInitialized()) return getPersistenceCache().getInstance(guildId);
    return loadJsonSync(cwdPath('instances', `${guildId}.json`)) as Instance;
}

export function writeInstanceFile(guildId: string, instance: Instance): void {
    if (isPersistenceInitialized()) {
        getPersistenceCache().setInstance(guildId, instance);
        return;
    }

    writeJsonSync(cwdPath('instances', `${guildId}.json`), instance);
}

export function readCredentialsFile(guildId: string): Credentials {
    if (isPersistenceInitialized()) return getPersistenceCache().getCredentials(guildId);
    return loadJsonSync(cwdPath('credentials', `${guildId}.json`)) as Credentials;
}

export function writeCredentialsFile(guildId: string, credentials: Credentials): void {
    if (isPersistenceInitialized()) {
        getPersistenceCache().setCredentials(guildId, credentials);
        return;
    }

    writeJsonSync(cwdPath('credentials', `${guildId}.json`), credentials);
}
