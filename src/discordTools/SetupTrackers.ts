import type { Guild } from 'discord.js';
import type { DiscordBot } from '../types/discord.js';
import * as DiscordMessages from './discordMessages.js';
import * as DiscordTools from './discordTools.js';

export default async function setupTrackers(client: DiscordBot, guild: Guild) {
    const instance = client.getInstance(guild.id);

    await DiscordTools.clearTextChannel(guild.id, instance.channelId.trackers as string, 100);

    for (const trackerId in instance.trackers) {
        await DiscordMessages.sendTrackerMessage(guild.id, trackerId);
    }
}
