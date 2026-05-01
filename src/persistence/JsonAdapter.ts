import fs from 'node:fs';
import type { Credentials, Instance } from '../types/instance.js';
import {
    credentialsPath,
    instancePath,
    legacyGuildIds,
    readLegacyCredentials,
    readLegacyInstance,
    writeJsonAtomic,
} from './legacyJson.js';
import type { PersistenceAdapter } from './types.js';

export class JsonAdapter implements PersistenceAdapter {
    readonly name = 'json' as const;
    readonly deprecated = true;

    async init(): Promise<void> {}

    async close(): Promise<void> {}

    listGuildIds(): string[] {
        return legacyGuildIds();
    }

    hasGuild(guildId: string): boolean {
        return fs.existsSync(instancePath(guildId));
    }

    readInstance(guildId: string): Instance {
        return readLegacyInstance(guildId);
    }

    writeInstance(guildId: string, instance: Instance): void {
        writeJsonAtomic(instancePath(guildId), instance);
    }

    deleteGuild(guildId: string): void {
        for (const filePath of [instancePath(guildId), credentialsPath(guildId)]) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }

    readCredentials(guildId: string): Credentials {
        return readLegacyCredentials(guildId);
    }

    writeCredentials(guildId: string, credentials: Credentials): void {
        writeJsonAtomic(credentialsPath(guildId), credentials);
    }

    async flush(): Promise<void> {}
}
