import { getPersistenceCache, isPersistenceInitialized } from '../persistence/index.js';
import type { Credentials, Instance } from '../types/instance.js';
import { cwdPath, loadJsonSync, writeJsonSync } from '../utils/filesystemUtils.js';

export async function readInstanceFile(guildId: string): Promise<Instance> {
    if (isPersistenceInitialized()) return await getPersistenceCache().readGuildState(guildId);
    return loadJsonSync(cwdPath('instances', `${guildId}.json`)) as Instance;
}

export async function writeInstanceFile(guildId: string, instance: Instance): Promise<void> {
    if (isPersistenceInitialized()) {
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);
        return;
    }

    writeJsonSync(cwdPath('instances', `${guildId}.json`), instance);
}

export async function readCredentialsFile(guildId: string): Promise<Credentials> {
    if (isPersistenceInitialized()) return await getPersistenceCache().getCredentials(guildId);
    return loadJsonSync(cwdPath('credentials', `${guildId}.json`)) as Credentials;
}

export async function writeCredentialsFile(guildId: string, credentials: Credentials): Promise<void> {
    if (isPersistenceInitialized()) {
        await getPersistenceCache().setCredentials(guildId, credentials);
        return;
    }

    writeJsonSync(cwdPath('credentials', `${guildId}.json`), credentials);
}
