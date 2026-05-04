import type { Guild } from 'discord.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import { getPersistenceCache } from '../persistence/index.js';
import type { DiscordBot } from '../types/discord.js';

export default async function removeGuildChannels(client: DiscordBot, guild: Guild) {
    const instance = await getPersistenceCache().readGuildState(guild.id);

    let categoryId: string | null = null;
    for (const [channelName, channelId] of Object.entries(instance.channelId)) {
        if (channelName === 'category') {
            categoryId = channelId;
            continue;
        }

        await DiscordTools.removeTextChannel(guild.id, channelId as string);
        (instance.channelId as unknown as Record<string, string | null>)[channelName] = null;
    }

    await DiscordTools.removeCategory(guild.id, categoryId);
    instance.channelId.category = null;

    await getPersistenceCache().setDiscordReferencedIds(
        guild.id,
        Object.keys(instance.channelId).map((channelName) => ({ key: `channel.${channelName}`, value: null })),
    );
}
