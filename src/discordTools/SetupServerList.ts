import type { Guild } from 'discord.js';
import { getPersistenceCache } from '../persistence/index.js';
import type { DiscordBot } from '../types/discord.js';
import * as DiscordMessages from './discordMessages.js';
import * as DiscordTools from './discordTools.js';

export default async function setupServerList(client: DiscordBot, guild: Guild) {
    const instance = await getPersistenceCache().readGuildState(guild.id);

    await DiscordTools.clearTextChannel(guild.id, instance.channelId.servers as string, 100);

    for (const serverId in instance.serverList) {
        await DiscordMessages.sendServerMessage(guild.id, serverId);
    }
}
