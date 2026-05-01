import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Credentials, Instance } from '../types/instance.js';
import { cwdPath, loadJsonSync } from '../utils/filesystemUtils.js';

export function instancePath(guildId: string): string {
    return cwdPath('instances', `${guildId}.json`);
}

export function credentialsPath(guildId: string): string {
    return cwdPath('credentials', `${guildId}.json`);
}

export function legacyGuildIds(): string[] {
    const dir = cwdPath('instances');
    if (!fs.existsSync(dir)) return [];

    return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.basename(file, '.json'));
}

export function legacySourceManifest(): { guildCount: number; checksum: string } {
    const hash = crypto.createHash('sha256');
    const guildIds = legacyGuildIds().sort();
    for (const guildId of guildIds) {
        hash.update(guildId);
        hash.update('\0');
        if (fs.existsSync(instancePath(guildId))) {
            hash.update(fs.readFileSync(instancePath(guildId)));
        }
        hash.update('\0');
        if (fs.existsSync(credentialsPath(guildId))) {
            hash.update(fs.readFileSync(credentialsPath(guildId)));
        }
        hash.update('\0');
    }

    return {
        guildCount: guildIds.length,
        checksum: hash.digest('hex'),
    };
}

export function readLegacyInstance(guildId: string): Instance {
    return loadJsonSync(instancePath(guildId)) as Instance;
}

export function readLegacyCredentials(guildId: string): Credentials {
    if (!fs.existsSync(credentialsPath(guildId))) {
        return { hoster: null };
    }

    return loadJsonSync(credentialsPath(guildId)) as Credentials;
}

export function writeJsonAtomic(filePath: string, data: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
    fs.renameSync(tempPath, filePath);
}
