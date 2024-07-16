const DiscordMessages = require('./discordMessages');
const DiscordTools = require('./discordTools');

module.exports = async (client, guild) => {
    const instance = client.getInstance(guild.id);

    await DiscordTools.clearTextChannel(guild.id, instance.channelId.servers, 100);

    for (const serverId in instance.serverList) {
        await DiscordMessages.sendServerMessage(guild.id, serverId);
    }
};
