import * as DiscordMessages from '../discordTools/discordMessages.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default async function (rustplus: any, client: DiscordBot, message: any) {
    await DiscordMessages.sendTeamChatMessage(rustplus.guildId, message);
}
