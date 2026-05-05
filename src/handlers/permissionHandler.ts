import * as Discord from 'discord.js';
import config from '../config.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import { getPersistenceCache } from '../persistence/index.js';

const writeableChannels = ['commands', 'teamchat'];

export async function getPermissionsReset(client, guild, permissionWrite = false) {
    const instance = await getPersistenceCache().readGuildState(guild.id);

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

        perms.push({ id: guild.roles.everyone.id, type: Discord.OverwriteType.Role, deny: everyoneDeny });
        perms.push({ id: instance.role, type: Discord.OverwriteType.Role, allow: roleAllow, deny: roleDeny });

        if (instance.adminRole !== null) {
            perms.push({ id: instance.adminRole, type: Discord.OverwriteType.Role, allow: roleAllow, deny: roleDeny });
        }

        if (config.discord.ownerUserId !== null) {
            perms.push({
                id: config.discord.ownerUserId,
                type: Discord.OverwriteType.Member,
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

        perms.push({
            id: guild.roles.everyone.id,
            type: Discord.OverwriteType.Role,
            allow: everyoneAllow,
            deny: everyoneDeny,
        });

        const botId = client.user?.id;
        if (botId) {
            perms.push({
                id: botId,
                type: Discord.OverwriteType.Member,
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
            type: Discord.OverwriteType.Member,
            deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
        });
    }

    return perms;
}

export async function getPermissionsRemoved(client, guild) {
    const instance = await getPersistenceCache().readGuildState(guild.id);

    const perms = [];

    if (instance.role !== null) {
        perms.push({
            id: instance.role,
            type: Discord.OverwriteType.Role,
            deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
        });
    }

    if (instance.adminRole !== null) {
        perms.push({
            id: instance.adminRole,
            type: Discord.OverwriteType.Role,
            deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
        });
    }

    perms.push({
        id: guild.roles.everyone.id,
        type: Discord.OverwriteType.Role,
        deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
    });

    return perms;
}

export async function resetPermissionsAllChannels(client, guild) {
    const instance = await getPersistenceCache().readGuildState(guild.id);

    if (instance.channelId.category === null) return;

    const category = await DiscordTools.getCategoryById(guild.id, instance.channelId.category);
    if (category) {
        const perms = await getPermissionsReset(client, guild);
        await category.permissionOverwrites.set(perms).catch((e) => {
            client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warn');
        });
    }

    for (const [name, id] of Object.entries(instance.channelId)) {
        const permissionWrite = writeableChannels.includes(name);

        const channel = DiscordTools.getTextChannelById(guild.id, id as string);
        if (channel) {
            const perms = await getPermissionsReset(client, guild, permissionWrite);
            await channel.permissionOverwrites.set(perms).catch((e) => {
                client.log(
                    client.intlGet(null, 'warningCap'),
                    `Failed to set channel permissions: ${e.message}`,
                    'warn',
                );
            });
        }
    }
}
