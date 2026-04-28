import * as DiscordMessages from '../discordTools/discordMessages.js';

export default async function (rustplus: any, client: any, message: any) {
    await DiscordMessages.sendTeamChatMessage(rustplus.guildId, message);
}