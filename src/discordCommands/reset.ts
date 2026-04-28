const Builder = require('@discordjs/builders');
const Utils = require('../util/utils');

const DiscordEmbeds = require('../discordTools/discordEmbeds');
const DiscordMessages = require('../discordTools/discordMessages');
const DiscordTools = require('../discordTools/discordTools');
import * as PermissionHandler from '../handlers/permissionHandler.js';

export default {
    name: 'reset',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('reset')
            .setDescription(client.intlGet(guildId, 'commandsResetDesc'))
            .addSubcommand((subcommand) =>
                subcommand.setName('discord').setDescription(client.intlGet(guildId, 'commandsResetDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('information')
                    .setDescription(client.intlGet(guildId, 'commandsResetInformationDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('servers').setDescription(client.intlGet(guildId, 'commandsResetServersDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('settings').setDescription(client.intlGet(guildId, 'commandsResetSettingsDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('switches').setDescription(client.intlGet(guildId, 'commandsResetSwitchesDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('alarms').setDescription(client.intlGet(guildId, 'commandsResetAlarmsDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('storagemonitors')
                    .setDescription(client.intlGet(guildId, 'commandsResetStorageMonitorsDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('trackers').setDescription(client.intlGet(guildId, 'commandsResetTrackersDesc')),
            );
    },

    async execute(client, interaction) {
        const instance = client.getInstance(interaction.guildId);

        const verifyId = Utils.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;

        if (!client.isAdministrator(interaction)) {
            const str = client.intlGet(interaction.guildId, 'missingPermission');
            client.interactionReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = DiscordTools.getGuild(interaction.guildId);

        switch (interaction.options.getSubcommand()) {
            case 'discord':
                {
                    await require('../discordTools/RemoveGuildChannels')(client, guild);

                    const category = await require('../discordTools/SetupGuildCategory')(client, guild);
                    await require('../discordTools/SetupGuildChannels')(client, guild, category);

                    const perms = PermissionHandler.getPermissionsRemoved(client, guild);
                    await category.permissionOverwrites.set(perms).catch((e) => {
                    client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warn');
                });

                    await DiscordTools.clearTextChannel(guild.id, instance.channelId.information, 100);
                    await DiscordTools.clearTextChannel(guild.id, instance.channelId.switches, 100);
                    await DiscordTools.clearTextChannel(guild.id, instance.channelId.switchGroups, 100);
                    await DiscordTools.clearTextChannel(guild.id, instance.channelId.storageMonitors, 100);

                    const rustplus = client.rustplusInstances[guild.id];
                    if (rustplus && rustplus.isOperational) {
                        await rustplus.map.writeMap(false, true);
                        await DiscordMessages.sendUpdateMapInformationMessage(rustplus);
                    }

                    await require('../discordTools/SetupServerList')(client, guild);
                    await require('../discordTools/SetupSettingsMenu')(client, guild, true);

                    if (rustplus && rustplus.isOperational) {
                        await require('../discordTools/SetupSwitches')(client, rustplus);
                        await require('../discordTools/SetupSwitchGroups')(client, rustplus);
                        await require('../discordTools/SetupAlarms')(client, rustplus);
                        await require('../discordTools/SetupStorageMonitors')(client, rustplus);
                    }

                    await require('../discordTools/SetupTrackers')(client, guild);

                    await PermissionHandler.resetPermissionsAllChannels(client, guild);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `discord`,
                        }),
                    );
                }
                break;

            case 'information':
                {
                    await DiscordTools.clearTextChannel(guild.id, instance.channelId.information, 100);

                    const rustplus = client.rustplusInstances[guild.id];
                    if (rustplus && rustplus.isOperational) {
                        await rustplus.map.writeMap(false, true);
                        await DiscordMessages.sendUpdateMapInformationMessage(rustplus);
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `information`,
                        }),
                    );
                }
                break;

            case 'servers':
                {
                    const perms = PermissionHandler.getPermissionsRemoved(client, guild);

                    const category = await DiscordTools.getCategoryById(guild.id, instance.channelId.category);
                    await category.permissionOverwrites.set(perms).catch((e) => {
                    client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warn');
                });

                    await require('../discordTools/SetupServerList')(client, guild);

                    await PermissionHandler.resetPermissionsAllChannels(client, guild);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `servers`,
                        }),
                    );
                }
                break;

            case 'settings':
                {
                    const perms = PermissionHandler.getPermissionsRemoved(client, guild);

                    const category = await DiscordTools.getCategoryById(guild.id, instance.channelId.category);
                    await category.permissionOverwrites.set(perms).catch((e) => {
                    client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warn');
                });

                    await require('../discordTools/SetupSettingsMenu')(client, guild, true);

                    await PermissionHandler.resetPermissionsAllChannels(client, guild);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `settings`,
                        }),
                    );
                }
                break;

            case 'switches':
                {
                    await DiscordTools.clearTextChannel(guild.id, instance.channelId.switches, 100);
                    await DiscordTools.clearTextChannel(guild.id, instance.channelId.switchGroups, 100);

                    const perms = PermissionHandler.getPermissionsRemoved(client, guild);

                    const category = await DiscordTools.getCategoryById(guild.id, instance.channelId.category);
                    await category.permissionOverwrites.set(perms).catch((e) => {
                    client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warn');
                });

                    const rustplus = client.rustplusInstances[guild.id];
                    if (rustplus && rustplus.isOperational) {
                        await require('../discordTools/SetupSwitches')(client, rustplus);
                        await require('../discordTools/SetupSwitchGroups')(client, rustplus);
                    }

                    await PermissionHandler.resetPermissionsAllChannels(client, guild);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `switches`,
                        }),
                    );
                }
                break;

            case 'alarms':
                {
                    const rustplus = client.rustplusInstances[guild.id];
                    if (rustplus && rustplus.isOperational) {
                        await require('../discordTools/SetupAlarms')(client, rustplus);
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `alarms`,
                        }),
                    );
                }
                break;

            case 'storagemonitors':
                {
                    await DiscordTools.clearTextChannel(guild.id, instance.channelId.storageMonitors, 100);

                    const perms = PermissionHandler.getPermissionsRemoved(client, guild);

                    const category = await DiscordTools.getCategoryById(guild.id, instance.channelId.category);
                    await category.permissionOverwrites.set(perms).catch((e) => {
                    client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warn');
                });

                    const rustplus = client.rustplusInstances[guild.id];
                    if (rustplus && rustplus.isOperational) {
                        await require('../discordTools/SetupStorageMonitors')(client, rustplus);
                    }

                    await PermissionHandler.resetPermissionsAllChannels(client, guild);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `storagemonitors`,
                        }),
                    );
                }
                break;

            case 'trackers':
                {
                    const perms = PermissionHandler.getPermissionsRemoved(client, guild);

                    const category = await DiscordTools.getCategoryById(guild.id, instance.channelId.category);
                    await category.permissionOverwrites.set(perms).catch((e) => {
                    client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warn');
                });

                    await require('../discordTools/SetupTrackers')(client, guild);

                    await PermissionHandler.resetPermissionsAllChannels(client, guild);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `trackers`,
                        }),
                    );
                }
                break;

            default:
                break;
        }

        const str = client.intlGet(interaction.guildId, 'resetSuccess');
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
        client.log(client.intlGet(null, 'infoCap'), str);
    },
};
