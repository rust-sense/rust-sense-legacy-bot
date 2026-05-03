import type { JsonAdapter } from './JsonAdapter.js';
import { PersistenceService } from './PersistenceService.js';
import type { PersistenceAdapter } from './types.js';

interface LegacyJsonMigrationLogger {
    info(message: string): void;
}

export async function migrateFromJsonAdapter(
    source: JsonAdapter,
    target: PersistenceAdapter,
    logger: LegacyJsonMigrationLogger = console,
): Promise<{ guildCount: number; checksum: string }> {
    const manifest = source.sourceManifest();
    const sourceService = new PersistenceService(source);
    const guildIds = source.listGuildIds().sort();

    logger.info(
        `[persistence] Legacy JSON migration source scan found ${manifest.guildCount} guild file(s), checksum=${manifest.checksum}.`,
    );

    for (const guildId of guildIds) {
        logger.info(`[persistence] Migrating legacy JSON guild ${guildId}: reading instance and credentials.`);
        await target.bootstrapGuildState(guildId, await sourceService.readGuildState(guildId));
        await target.writeCredentials(guildId, await source.readCredentials(guildId));
        logger.info(`[persistence] Migrating legacy JSON guild ${guildId}: wrote relational state and credentials.`);
    }

    return manifest;
}
