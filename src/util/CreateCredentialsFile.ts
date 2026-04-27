import fs from 'node:fs';

import { cwdPath } from '../utils/filesystemUtils.js';

interface ClientLike {
    log: (title: string, message: string, level: string) => void;
    intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string;
}

export default function createCredentialsFile(client: ClientLike, guild: { id: string }): void {
    const guildCredentialsFilePath = cwdPath('credentials', `${guild.id}.json`);
    if (!fs.existsSync(guildCredentialsFilePath)) {
        fs.writeFileSync(guildCredentialsFilePath, JSON.stringify({ hoster: null }, null, 2));
    }
}
