import { getPersistenceCache } from '../persistence/index.js';
import type { Credentials, Instance } from '../types/instance.js';
import { cwdPath, loadJsonSync, writeJsonSync } from '../utils/filesystemUtils.js';

export function readInstanceFile(guildId: string): Instance {
    try {
        return getPersistenceCache().getInstance(guildId);
    } catch {
        return loadJsonSync(cwdPath('instances', `${guildId}.json`)) as Instance;
    }
}

export function writeInstanceFile(guildId: string, instance: Instance): void {
    try {
        getPersistenceCache().setInstance(guildId, instance);
    } catch {
        writeJsonSync(cwdPath('instances', `${guildId}.json`), instance);
    }
}

export function readCredentialsFile(guildId: string): Credentials {
    try {
        return getPersistenceCache().getCredentials(guildId);
    } catch {
        return loadJsonSync(cwdPath('credentials', `${guildId}.json`)) as Credentials;
    }
}

export function writeCredentialsFile(guildId: string, credentials: Credentials): void {
    try {
        getPersistenceCache().setCredentials(guildId, credentials);
    } catch {
        writeJsonSync(cwdPath('credentials', `${guildId}.json`), credentials);
    }
}
