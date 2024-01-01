/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

import Discord from 'discord.js';

import DiscordTools from '../discordTools/discordTools.js';

const writeableChannels = [
    'commands', 
    'teamchat'
];

export default {
    getPermissionsReset: function (client, guild, permissionWrite = false) {
        const instance = client.getInstance(guild.id);

        const perms = [];
        const everyoneAllow = [];
        const everyoneDeny = [];
        const roleAllow = [];
        const roleDeny = [];

        if (instance.role !== null) {
            if (permissionWrite) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'bigint' is not assignable to par... Remove this comment to see the full error message
                roleAllow.push(Discord.PermissionFlagsBits.SendMessages);
            } else {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'bigint' is not assignable to par... Remove this comment to see the full error message
                roleDeny.push(Discord.PermissionFlagsBits.SendMessages);
            }

            // @ts-expect-error TS(2345) FIXME: Argument of type 'bigint' is not assignable to par... Remove this comment to see the full error message
            everyoneDeny.push(Discord.PermissionFlagsBits.ViewChannel);
            // @ts-expect-error TS(2345) FIXME: Argument of type 'bigint' is not assignable to par... Remove this comment to see the full error message
            everyoneDeny.push(Discord.PermissionFlagsBits.SendMessages);
            // @ts-expect-error TS(2345) FIXME: Argument of type 'bigint' is not assignable to par... Remove this comment to see the full error message
            roleAllow.push(Discord.PermissionFlagsBits.ViewChannel);

            // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
            perms.push({ id: guild.roles.everyone.id, deny: everyoneDeny });
            // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
            perms.push({ id: instance.role, allow: roleAllow, deny: roleDeny });

            if (instance.adminRole !== null) {
                // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
                perms.push({ id: instance.adminRole, allow: roleAllow, deny: roleDeny });
            }
        } else {
            if (permissionWrite) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'bigint' is not assignable to par... Remove this comment to see the full error message
                everyoneAllow.push(Discord.PermissionFlagsBits.SendMessages);
            } else {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'bigint' is not assignable to par... Remove this comment to see the full error message
                everyoneDeny.push(Discord.PermissionFlagsBits.SendMessages);
            }

            // @ts-expect-error TS(2345) FIXME: Argument of type 'bigint' is not assignable to par... Remove this comment to see the full error message
            everyoneAllow.push(Discord.PermissionFlagsBits.ViewChannel);

            // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
            perms.push({ id: guild.roles.everyone.id, allow: everyoneAllow, deny: everyoneDeny });
        }

        for (const discordId of instance.blacklist['discordIds']) {
            perms.push({
                // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
                id: discordId,
                // @ts-expect-error TS(2322) FIXME: Type 'bigint' is not assignable to type 'never'.
                deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
            });
        }

        return perms;
    },

    getPermissionsRemoved: function (client, guild) {
        const instance = client.getInstance(guild.id);

        const perms = [];

        if (instance.role !== null) {
            perms.push({
                // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
                id: instance.role,
                // @ts-expect-error TS(2322) FIXME: Type 'bigint' is not assignable to type 'never'.
                deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
            });
        }

        if (instance.adminRole !== null) {
            perms.push({
                // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
                id: instance.adminRole,
                // @ts-expect-error TS(2322) FIXME: Type 'bigint' is not assignable to type 'never'.
                deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
            })
        }

        perms.push({
            // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
            id: guild.roles.everyone.id,
            // @ts-expect-error TS(2322) FIXME: Type 'bigint' is not assignable to type 'never'.
            deny: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
        });

        return perms;
    },

    resetPermissionsAllChannels: async function (client, guild) {
        const instance = client.getInstance(guild.id);

        if (instance.channelId.category === null) return;

        const category = await DiscordTools.getCategoryById(guild.id, instance.channelId.category);
        if (category) {
            const perms = module.exports.getPermissionsReset(client, guild);
            // @ts-expect-error TS(2339) FIXME: Property 'permissionOverwrites' does not exist on ... Remove this comment to see the full error message
            await category.permissionOverwrites.set(perms).catch((e) => {});
        }

        for (const [name, id] of Object.entries(instance.channelId)) {
            const permissionWrite = writeableChannels.includes(name);

            const channel = DiscordTools.getTextChannelById(guild.id, id);
            if (channel) {
                const perms = module.exports.getPermissionsReset(client, guild, permissionWrite);
                // @ts-expect-error TS(2339) FIXME: Property 'permissionOverwrites' does not exist on ... Remove this comment to see the full error message
                await channel.permissionOverwrites.set(perms).catch((e) => {});
            }
        }
    },
};
