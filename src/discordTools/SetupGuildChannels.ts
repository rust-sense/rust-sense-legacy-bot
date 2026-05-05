import type { CategoryChannel, Guild, TextChannel } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';

import * as DiscordTools from '../discordTools/discordTools.js';
import * as PermissionHandler from '../handlers/permissionHandler.js';
import { getPersistenceCache } from '../persistence/index.js';
import type { DiscordBot } from '../types/discord.js';

export default async function setupGuildChannels(client: DiscordBot, guild: Guild, category: CategoryChannel | null) {
    if (!category) {
        return;
    }

    await addTextChannel(client.intlGet(guild.id, 'channelNameInformation'), 'information', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameServers'), 'servers', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameSettings'), 'settings', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameCommands'), 'commands', client, guild, category, true);
    await addTextChannel(client.intlGet(guild.id, 'channelNameEvents'), 'events', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameTeamchat'), 'teamchat', client, guild, category, true);
    await addTextChannel(client.intlGet(guild.id, 'channelNameSwitches'), 'switches', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameSwitchGroups'), 'switchGroups', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameAlarms'), 'alarms', client, guild, category);
    await addTextChannel(
        client.intlGet(guild.id, 'channelNameStorageMonitors'),
        'storageMonitors',
        client,
        guild,
        category,
    );
    await addTextChannel(client.intlGet(guild.id, 'channelNameActivity'), 'activity', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameTrackers'), 'trackers', client, guild, category);
}

async function addTextChannel(
    name: string,
    idName: string,
    client: DiscordBot,
    guild: Guild,
    parent: CategoryChannel,
    permissionWrite = false,
) {
    const instance = await getPersistenceCache().readGuildState(guild.id);
    const perms = await PermissionHandler.getPermissionsReset(client, guild, permissionWrite);

    let channel: TextChannel | undefined = undefined;
    if (instance.channelId[idName as keyof typeof instance.channelId] !== null) {
        channel = DiscordTools.getTextChannelById(
            guild.id,
            instance.channelId[idName as keyof typeof instance.channelId] as string,
        );
        if (channel && !botCanUseTextChannel(guild, channel)) {
            (instance.channelId as unknown as Record<string, string | null>)[idName] = null;
            await getPersistenceCache().setDiscordReferencedIds(guild.id, [{ key: `channel.${idName}`, value: null }]);
            channel = undefined;
        }
    }

    if (channel === undefined) {
        const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
        channel = await DiscordTools.addTextChannel(guild.id, normalizedName, parent.id, perms);
        if (!channel) {
            return;
        }
        (instance.channelId as unknown as Record<string, string | null>)[idName] = channel.id;
        await getPersistenceCache().setDiscordReferencedIds(guild.id, [
            { key: `channel.${idName}`, value: channel.id },
        ]);
    }

    if (channel && (instance.firstTime || channel.parentId !== parent.id)) {
        try {
            await channel.setParent(parent.id, { lockPermissions: false });
        } catch (e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                `${client.intlGet(null, 'couldNotSetParent', { channelId: channel.id })}: ${e}`,
                'error',
            );
        }
    }

    try {
        await channel.permissionOverwrites.set(perms);
    } catch (e) {
        client.log(
            client.intlGet(null, 'errorCap'),
            `Could not set permission overwrites for channel ${channel.id}: ${e}`,
            'error',
        );
    }

    /* Currently, this halts the entire application... Too lazy to fix...
       It is possible to just remove the channels and let the bot recreate them with correct name language */
    //channel.setName(name);
}

function botCanUseTextChannel(guild: Guild, channel: TextChannel): boolean {
    const me = guild.members?.me;
    if (!me) return true;

    const permissions = channel.permissionsFor(me);
    return (
        permissions?.has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
        ]) ?? false
    );
}
