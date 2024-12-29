const DiscordTools = require('../discordTools/discordTools');

module.exports = async (client, guild) => {
    const instance = client.getInstance(guild.id);

    let categoryId = null;
    for (const [channelName, channelId] of Object.entries(instance.channelId)) {
        if (channelName === 'category') {
            categoryId = channelId;
            continue;
        }

        await DiscordTools.removeTextChannel(guild.id, channelId);
        instance.channelId[channelName] = null;
    }

    await DiscordTools.removeCategory(guild.id, categoryId);
    instance.channelId['category'] = null;

    client.setInstance(guild.id, instance);
};
