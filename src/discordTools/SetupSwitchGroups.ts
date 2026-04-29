import type { DiscordBot } from '../types/discord.js';
import * as DiscordMessages from './discordMessages.js';
import * as DiscordTools from './discordTools.js';

export default async function setupSwitchGroups(client: DiscordBot, rustplus: any) {
    const instance = client.getInstance(rustplus.guildId);
    const guildId = rustplus.guildId;

    if (rustplus.isNewConnection) {
        await DiscordTools.clearTextChannel(guildId, instance.channelId.switchGroups as string, 100);
    }

    for (const groupId in instance.serverList[rustplus.serverId].switchGroups) {
        await DiscordMessages.sendSmartSwitchGroupMessage(rustplus.guildId, rustplus.serverId, groupId);
    }
}
