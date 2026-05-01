import type { Guild } from 'discord.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import type { DiscordBot } from '../types/discord.js';

export default async function removeGuildChannels(client: DiscordBot, guild: Guild) {
    const instance = client.getInstance(guild.id);

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

    client.setInstance(guild.id, instance);
}
