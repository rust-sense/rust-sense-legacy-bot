import * as Discord from 'discord.js';

import { resolve } from '../container.js';

function getClient() {
    return resolve<{
        guilds: Discord.GuildManager;
        log: (title: string, message: string, level: string) => void;
        intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string;
    }>('discordBot');
}

export function getGuild(guildId: string): Discord.Guild | undefined {
    const client = getClient();
    try {
        return client.guilds.cache.get(guildId);
    } catch (_e) {
        client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'couldNotFindGuild', { guildId }), 'error');
    }
    return undefined;
}

export function getRole(guildId: string, roleId: string): Discord.Role | undefined {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        try {
            return guild.roles.cache.get(roleId);
        } catch (_e) {
            client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'couldNotFindRole', { roleId }), 'error');
        }
    }
    return undefined;
}

export async function getUserById(guildId: string, userId: string): Promise<Discord.GuildMember | undefined> {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        try {
            const user = await guild.members.fetch(userId);
            if (user instanceof Map) return user.get(userId);
            return user;
        } catch (_e) {
            client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'couldNotFindUser', { userId }), 'error');
        }
    }
    return undefined;
}

export function getTextChannelById(guildId: string, channelId: string): Discord.TextChannel | undefined {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        let channel: Discord.GuildBasedChannel | undefined = undefined;
        try {
            channel = guild.channels.cache.get(channelId);
        } catch (_e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'couldNotFindChannel', { channel: channelId }),
                'error',
            );
        }

        if (channel && channel.type === Discord.ChannelType.GuildText) {
            return channel as Discord.TextChannel;
        }
    }
    return undefined;
}

export function getTextChannelByName(guildId: string, name: string): Discord.TextChannel | undefined {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        let channel: Discord.GuildBasedChannel | undefined = undefined;
        try {
            channel = guild.channels.cache.find((c) => c.name === name);
        } catch (_e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'couldNotFindChannel', { channel: name }),
                'error',
            );
        }

        if (channel && channel.type === Discord.ChannelType.GuildText) {
            return channel as Discord.TextChannel;
        }
    }
    return undefined;
}

export function getCategoryById(guildId: string, categoryId: string): Discord.CategoryChannel | undefined {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        let category: Discord.GuildBasedChannel | undefined = undefined;
        try {
            category = guild.channels.cache.get(categoryId);
        } catch (_e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'couldNotFindCategory', { category: categoryId }),
                'error',
            );
        }

        if (category && category.type === Discord.ChannelType.GuildCategory) {
            return category as Discord.CategoryChannel;
        }
    }
    return undefined;
}

export function getCategoryByName(guildId: string, name: string): Discord.CategoryChannel | undefined {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        let category: Discord.GuildBasedChannel | undefined = undefined;
        try {
            category = guild.channels.cache.find((c) => c.name === name);
        } catch (_e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'couldNotFindCategory', { category: name }),
                'error',
            );
        }

        if (category && category.type === Discord.ChannelType.GuildCategory) {
            return category as Discord.CategoryChannel;
        }
    }
    return undefined;
}

export async function getMessageById(
    guildId: string,
    channelId: string,
    messageId: string,
): Promise<Discord.Message | undefined> {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        const channel = getTextChannelById(guildId, channelId);

        if (channel) {
            try {
                return await channel.messages.fetch(messageId);
            } catch (_e) {
                client.log(
                    client.intlGet(null, 'errorCap'),
                    client.intlGet(null, 'couldNotFindMessage', { message: messageId }),
                    'error',
                );
            }
        }
    }
    return undefined;
}

export async function deleteMessageById(guildId: string, channelId: string, messageId: string): Promise<void> {
    const message = await getMessageById(guildId, channelId, messageId);
    if (message) {
        try {
            await message.delete();
        } catch (_e) {
            /* Message might already be deleted */
        }
    }
}

export async function clearTextChannel(guildId: string, channelId: string, limit = 100): Promise<void> {
    const channel = getTextChannelById(guildId, channelId);
    if (channel) {
        try {
            const messages = await channel.messages.fetch({ limit });
            await channel.bulkDelete(messages, true);
        } catch (_e) {
            /* Ignore errors */
        }
    }
}

export function getDiscordFormattedDate(unixTime: number): string {
    return `<t:${Math.floor(unixTime / 1000)}:R>`;
}

export async function addCategory(
    guildId: string,
    name: string,
    permissions: Discord.OverwriteResolvable[] = [],
): Promise<Discord.CategoryChannel | undefined> {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        try {
            return await guild.channels.create({
                name,
                type: Discord.ChannelType.GuildCategory,
                permissionOverwrites: permissions,
            });
        } catch (_e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'couldNotCreateCategory', { name }),
                'error',
            );
        }
    }
    return undefined;
}

export async function addTextChannel(
    guildId: string,
    name: string,
    parentId: string,
    permissions: Discord.OverwriteResolvable[] = [],
): Promise<Discord.TextChannel | undefined> {
    const client = getClient();
    const guild = getGuild(guildId);

    if (guild) {
        try {
            return await guild.channels.create({
                name,
                type: Discord.ChannelType.GuildText,
                parent: parentId,
                permissionOverwrites: permissions,
            });
        } catch (_e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'couldNotCreateChannel', { name }),
                'error',
            );
        }
    }
    return undefined;
}

export async function removeCategory(guildId: string, categoryId: string): Promise<void> {
    const category = getCategoryById(guildId, categoryId);
    if (category) {
        try {
            await category.delete();
        } catch (_e) {
            /* Ignore errors */
        }
    }
}

export async function removeTextChannel(guildId: string, channelId: string): Promise<void> {
    const channel = getTextChannelById(guildId, channelId);
    if (channel) {
        try {
            await channel.delete();
        } catch (_e) {
            /* Ignore errors */
        }
    }
}
