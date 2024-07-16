const DiscordCommandHandler = require('../handlers/discordCommandHandler');
const DiscordTools = require('../discordTools/discordTools');

module.exports = {
    name: 'messageCreate',
    async execute(client, message) {
        const instance = client.getInstance(message.guild.id);
        const rustplus = client.rustplusInstances[message.guild.id];

        if (message.author.bot || !rustplus || (rustplus && !rustplus.isOperational)) return;

        if (
            instance.blacklist['discordIds'].includes(message.author.id) &&
            Object.values(instance.channelId).includes(message.channelId)
        ) {
            const guild = DiscordTools.getGuild(message.guild.id);
            const channel = DiscordTools.getTextChannelById(guild.id, message.channelId);
            client.log(
                client.intlGet(null, 'infoCap'),
                client.intlGet(null, `userPartOfBlacklistDiscord`, {
                    guild: `${guild.name} (${guild.id})`,
                    channel: `${channel.name} (${channel.id})`,
                    user: `${message.author.username} (${message.author.id})`,
                    message: message.cleanContent,
                }),
            );
            return;
        }

        if (message.channelId === instance.channelId.commands) {
            await DiscordCommandHandler.discordCommandHandler(rustplus, client, message);
        } else if (message.channelId === instance.channelId.teamchat) {
            const guild = DiscordTools.getGuild(message.guild.id);
            const channel = DiscordTools.getTextChannelById(guild.id, message.channelId);
            client.log(
                client.intlGet(null, 'infoCap'),
                client.intlGet(null, `logDiscordMessage`, {
                    guild: `${guild.name} (${guild.id})`,
                    channel: `${channel.name} (${channel.id})`,
                    user: `${message.author.username} (${message.author.id})`,
                    message: message.cleanContent,
                }),
            );
            await rustplus.sendInGameMessage(`${message.author.username}: ${message.cleanContent}`);
        }
    },
};
