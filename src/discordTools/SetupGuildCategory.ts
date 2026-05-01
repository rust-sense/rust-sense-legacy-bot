import type { CategoryChannel, Guild } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';

import * as DiscordTools from '../discordTools/discordTools.js';
import * as PermissionHandler from '../handlers/permissionHandler.js';
import type { DiscordBot } from '../types/discord.js';

export default async function setupGuildCategory(
    client: DiscordBot,
    guild: Guild,
): Promise<CategoryChannel | undefined> {
    const instance = client.getInstance(guild.id);
    const perms = PermissionHandler.getPermissionsReset(client, guild, false);

    let category: CategoryChannel | undefined = undefined;
    if (instance.channelId.category !== null) {
        category = DiscordTools.getCategoryById(guild.id, instance.channelId.category);
        if (category && !botHasChannelPermissions(guild, category)) {
            category = undefined;
        }
    }
    if (category === undefined) {
        category = await DiscordTools.addCategory(guild.id, 'rust-sense', perms);
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
}

function botHasChannelPermissions(guild: Guild, channel: CategoryChannel): boolean {
    const me = guild.members?.me;
    if (!me) return true;

    const permissions = channel.permissionsFor(me);
    return permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]) ?? false;
}
