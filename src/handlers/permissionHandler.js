const Discord = require('discord.js');

const DiscordTools = require('../discordTools/discordTools');

import config from '../config';

const writeableChannels = ['commands', 'teamchat'];

export function getPermissionsReset(client, guild, permissionWrite = false) {
    const instance = client.getInstance(guild.id);

    const perms = [];
    const everyoneAllow = [];
    const everyoneDeny = [];
    const roleAllow = [];
    const roleDeny = [];

    if (instance.role !== null) {
        if (permissionWrite) {
            roleAllow.push(Discord.PermissionFlagsBits.SendMessages);
        } else {
            roleDeny.push(Discord.PermissionFlagsBits.SendMessages);
        }

        everyoneDeny.push(Discord.PermissionFlagsBits.ViewChannel);
        everyoneDeny.push(Discord.PermissionFlagsBits.SendMessages);
        roleAllow.push(Discord.PermissionFlagsBits.ViewChannel);

        perms.push({ id: guild.roles.everyone.id, deny: everyoneDeny });
        perms.push({ id: instance.role, allow: roleAllow, deny: roleDeny });

        if (instance.adminRole !== null) {
            perms.push({ id: instance.adminRole, allow: roleAllow, deny: roleDeny });
        }

        if (config.discord.ownerUserId !== null) {
            perms.push({
                id: config.discord.ownerUserId,
                allow: roleAllow,
                deny: roleDeny,
            });
        }
    } else {
        if (permissionWrite) {
            everyoneAllow.push(Discord.PermissionFlagsBits.SendMessages);
        } else {
            everyoneDeny.push(Discord.PermissionFlagsBits.SendMessages);
        }

        everyoneAllow.push(Discord.PermissionFlagsBits.ViewChannel);

        perms.push({ id: guild.roles.everyone.id, allow: everyoneAllow, deny: everyoneDeny });

        const botId = client.user?.id;
        if (botId) {
            perms.push({
                id: botId,
                allow: [
                    Discord.PermissionFlagsBits.ViewChannel,
                    Discord.PermissionFlagsBits.SendMessages,
                    Discord.PermissionFlagsBits.ReadMessageHistory,
                ],
            });
        }
    }

    for (const discordId of instance.blacklist['discordIds']) {
        perms.push({
            id: discordId,
            deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
        });
    }

    return perms;
}

export function getPermissionsRemoved(client, guild) {
    const instance = client.getInstance(guild.id);

    const perms = [];

    if (instance.role !== null) {
        perms.push({
            id: instance.role,
            deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
        });
    }

    if (instance.adminRole !== null) {
        perms.push({
            id: instance.adminRole,
            deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
        });
    }

    perms.push({
        id: guild.roles.everyone.id,
        deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
    });

    return perms;
}

export async function resetPermissionsAllChannels(client, guild) {
    const instance = client.getInstance(guild.id);

    if (instance.channelId.category === null) return;

    const category = await DiscordTools.getCategoryById(guild.id, instance.channelId.category);
    if (category) {
        const perms = getPermissionsReset(client, guild);
        await category.permissionOverwrites.set(perms).catch((e) => {});
    }

    for (const [name, id] of Object.entries(instance.channelId)) {
        const permissionWrite = writeableChannels.includes(name);

        const channel = DiscordTools.getTextChannelById(guild.id, id);
        if (channel) {
            const perms = getPermissionsReset(client, guild, permissionWrite);
            await channel.permissionOverwrites.set(perms).catch((e) => {});
        }
    }
}
