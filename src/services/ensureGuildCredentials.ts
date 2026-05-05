import { getPersistenceCache } from '../persistence/index.js';

export default async function ensureGuildCredentials(_client: unknown, guild: { id: string }): Promise<void> {
    const credentials = await getPersistenceCache().getCredentials(guild.id);
    await getPersistenceCache().setCredentials(guild.id, credentials);
}
