import fs from 'node:fs';

import { getPersistenceCache } from '../persistence/index.js';
import { cwdPath } from '../utils/filesystemUtils.js';

interface ClientLike {
    log: (title: string, message: string, level: string) => void;
    intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string;
}

export default function createCredentialsFile(client: ClientLike, guild: { id: string }): void {
    const guildCredentialsFilePath = cwdPath('credentials', `${guild.id}.json`);
    let persistedCredentialsExist = fs.existsSync(guildCredentialsFilePath);
    try {
        persistedCredentialsExist = persistedCredentialsExist || getPersistenceCache().hasGuild(guild.id);
    } catch {
        /* Persistence is not initialized in some tests and scripts. */
    }

    if (!persistedCredentialsExist) {
        fs.writeFileSync(guildCredentialsFilePath, JSON.stringify({ hoster: null }, null, 2));
    }
}
