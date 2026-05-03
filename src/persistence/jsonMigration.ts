import type { JsonAdapter } from './JsonAdapter.js';
import { PersistenceService } from './PersistenceService.js';
import type { PersistenceAdapter } from './types.js';

export async function migrateFromJsonAdapter(
    source: JsonAdapter,
    target: PersistenceAdapter,
): Promise<{ guildCount: number; checksum: string }> {
    const manifest = source.sourceManifest();
    const sourceService = new PersistenceService(source);

    for (const guildId of source.listGuildIds()) {
        await target.bootstrapGuildState(guildId, await sourceService.readGuildState(guildId));
        await target.writeCredentials(guildId, await source.readCredentials(guildId));
    }

    return manifest;
}
