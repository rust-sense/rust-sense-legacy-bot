import DiscordMessages from '../discordTools/discordMessages.js';

export default async function (rustplus, client, message) {
    await DiscordMessages.sendTeamChatMessage(rustplus.guildId, message);
}
