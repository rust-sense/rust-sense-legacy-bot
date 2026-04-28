// @ts-nocheck
const DiscordMessages = require('../discordTools/discordMessages');

module.exports = async function (rustplus, client, message) {
    await DiscordMessages.sendTeamChatMessage(rustplus.guildId, message);
};
