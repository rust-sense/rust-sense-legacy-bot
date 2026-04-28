// @ts-nocheck
const Discord = require('discord.js');
const DiscordTools = require('../discordTools/discordTools');
import * as PermissionHandler from '../handlers/permissionHandler.js';

module.exports = async (client, guild) => {
    const instance = client.getInstance(guild.id);
    const perms = PermissionHandler.getPermissionsReset(client, guild, false);

    let category = undefined;
    if (instance.channelId.category !== null) {
        category = DiscordTools.getCategoryById(guild.id, instance.channelId.category);
        if (category && !botHasChannelPermissions(guild, category)) {
            category = undefined;
        }
    }
    if (category === undefined) {
        category = await DiscordTools.addCategory(guild.id, 'rustplusplus', perms);
        if (!category) {
            return undefined;
        }
        instance.channelId.category = category.id;
        client.setInstance(guild.id, instance);
    }

    try {
        await category.permissionOverwrites.set(perms);
    } catch (e) {
        client.log(
            client.intlGet(null, 'errorCap'),
            `Could not set permission overwrites for category ${category.id}: ${e}`,
            'error',
        );
    }

    return category;
};

function botHasChannelPermissions(guild, channel) {
    const me = guild.members?.me;
    if (!me) return true;

    const permissions = channel.permissionsFor(me);
    return (
        permissions?.has([Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.ManageChannels]) ?? false
    );
}
