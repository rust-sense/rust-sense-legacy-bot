import type { Credentials, Instance } from '../types/instance.js';
import { cwdPath, loadJsonSync, writeJsonSync } from '../utils/filesystemUtils.js';

export function readInstanceFile(guildId: string): Instance {
    return loadJsonSync(cwdPath('instances', `${guildId}.json`)) as Instance;
}

export function writeInstanceFile(guildId: string, instance: Instance): void {
    writeJsonSync(cwdPath('instances', `${guildId}.json`), instance);
}

export function readCredentialsFile(guildId: string): Credentials {
    return loadJsonSync(cwdPath('credentials', `${guildId}.json`)) as Credentials;
}

export function writeCredentialsFile(guildId: string, credentials: Credentials): void {
    writeJsonSync(cwdPath('credentials', `${guildId}.json`), credentials);
}
