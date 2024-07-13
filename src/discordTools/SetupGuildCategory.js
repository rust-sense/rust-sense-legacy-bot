const DiscordTools = require('../discordTools/discordTools');
const PermissionHandler = require('../handlers/permissionHandler');

module.exports = async (client, guild) => {
    const instance = client.getInstance(guild.id);

    let category = undefined;
    if (instance.channelId.category !== null) {
        category = DiscordTools.getCategoryById(guild.id, instance.channelId.category);
    }
    if (category === undefined) {
        category = await DiscordTools.addCategory(guild.id, 'rustplusplus');
        instance.channelId.category = category.id;
        client.setInstance(guild.id, instance);
    }

    const perms = PermissionHandler.getPermissionsReset(client, guild, false);

    try {
        await category.permissionOverwrites.set(perms);
    } catch (e) {
        /* Ignore */
    }

    return category;
};
