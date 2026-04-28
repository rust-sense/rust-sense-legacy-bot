import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as PermissionHandler from '../handlers/permissionHandler.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

export default {
    name: 'reset',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
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

    async execute(client: DiscordBot, interaction: any) {
        const instance = client.getInstance(interaction.guildId);

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;

        if (!(client as any).isAdministrator(interaction)) {
            const str = client.intlGet(interaction.guildId, 'missingPermission');
            (client as any).interactionReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warning');
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = DiscordTools.getGuild(interaction.guildId);

        switch (interaction.options.getSubcommand()) {
            case 'discord':
                {
                    const RemoveGuildChannels = await import('../discordTools/RemoveGuildChannels.js');
                    await (RemoveGuildChannels as any).default(client, guild);

                    const SetupGuildCategory = await import('../discordTools/SetupGuildCategory.js');
                    const category = await (SetupGuildCategory as any).default(client, guild);
                    const SetupGuildChannels = await import('../discordTools/SetupGuildChannels.js');
                    await (SetupGuildChannels as any).default(client, guild, category);

                    const perms = PermissionHandler.getPermissionsRemoved(client, guild!);
                    await category!.permissionOverwrites.set(perms).catch((e: any) => {
                        client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warning');
                    });

                    await DiscordTools.clearTextChannel(guild!.id, instance.channelId.information as string, 100);
                    await DiscordTools.clearTextChannel(guild!.id, instance.channelId.switches as string, 100);
                    await DiscordTools.clearTextChannel(guild!.id, instance.channelId.switchGroups as string, 100);
                    await DiscordTools.clearTextChannel(guild!.id, instance.channelId.storageMonitors as string, 100);

                    const rustplus = (client as any).rustplusInstances[guild!.id];
                    if (rustplus && rustplus.isOperational) {
                        await rustplus.map.writeMap(false, true);
                        await DiscordMessages.sendUpdateMapInformationMessage(rustplus);
                    }

                    const SetupServerList = await import('../discordTools/SetupServerList.js');
                    await (SetupServerList as any).default(client, guild);
                    const SetupSettingsMenu = await import('../discordTools/SetupSettingsMenu.js');
                    await (SetupSettingsMenu as any).default(client, guild, true);

                    if (rustplus && rustplus.isOperational) {
                        const SetupSwitches = await import('../discordTools/SetupSwitches.js');
                        await (SetupSwitches as any).default(client, rustplus);
                        const SetupSwitchGroups = await import('../discordTools/SetupSwitchGroups.js');
                        await (SetupSwitchGroups as any).default(client, rustplus);
                        const SetupAlarms = await import('../discordTools/SetupAlarms.js');
                        await (SetupAlarms as any).default(client, rustplus);
                        const SetupStorageMonitors = await import('../discordTools/SetupStorageMonitors.js');
                        await (SetupStorageMonitors as any).default(client, rustplus);
                    }

                    const SetupTrackers = await import('../discordTools/SetupTrackers.js');
                    await (SetupTrackers as any).default(client, guild);

                    await PermissionHandler.resetPermissionsAllChannels(client, guild!);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `discord`,
                        }),
                        'info',
                    );
                }
                break;

            case 'information':
                {
                    await DiscordTools.clearTextChannel(guild!.id, instance.channelId.information as string, 100);

                    const rustplus = (client as any).rustplusInstances[guild!.id];
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
                        'info',
                    );
                }
                break;

            case 'servers':
                {
                    const perms = PermissionHandler.getPermissionsRemoved(client, guild!);

                    const category = await DiscordTools.getCategoryById(guild!.id, instance.channelId.category as string);
                    await category!.permissionOverwrites.set(perms).catch((e: any) => {
                        client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warning');
                    });

                    const SetupServerList = await import('../discordTools/SetupServerList.js');
                    await (SetupServerList as any).default(client, guild);

                    await PermissionHandler.resetPermissionsAllChannels(client, guild!);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `servers`,
                        }),
                        'info',
                    );
                }
                break;

            case 'settings':
                {
                    const perms = PermissionHandler.getPermissionsRemoved(client, guild!);

                    const category = await DiscordTools.getCategoryById(guild!.id, instance.channelId.category as string);
                    await category!.permissionOverwrites.set(perms).catch((e: any) => {
                        client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warning');
                    });

                    const SetupSettingsMenu = await import('../discordTools/SetupSettingsMenu.js');
                    await (SetupSettingsMenu as any).default(client, guild, true);

                    await PermissionHandler.resetPermissionsAllChannels(client, guild!);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `settings`,
                        }),
                        'info',
                    );
                }
                break;

            case 'switches':
                {
                    await DiscordTools.clearTextChannel(guild!.id, instance.channelId.switches as string, 100);
                    await DiscordTools.clearTextChannel(guild!.id, instance.channelId.switchGroups as string, 100);

                    const perms = PermissionHandler.getPermissionsRemoved(client, guild!);

                    const category = await DiscordTools.getCategoryById(guild!.id, instance.channelId.category as string);
                    await category!.permissionOverwrites.set(perms).catch((e: any) => {
                        client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warning');
                    });

                    const rustplus = (client as any).rustplusInstances[guild!.id];
                    if (rustplus && rustplus.isOperational) {
                        const SetupSwitches = await import('../discordTools/SetupSwitches.js');
                        await (SetupSwitches as any).default(client, rustplus);
                        const SetupSwitchGroups = await import('../discordTools/SetupSwitchGroups.js');
                        await (SetupSwitchGroups as any).default(client, rustplus);
                    }

                    await PermissionHandler.resetPermissionsAllChannels(client, guild!);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `switches`,
                        }),
                        'info',
                    );
                }
                break;

            case 'alarms':
                {
                    const rustplus = (client as any).rustplusInstances[guild!.id];
                    if (rustplus && rustplus.isOperational) {
                        const SetupAlarms = await import('../discordTools/SetupAlarms.js');
                        await (SetupAlarms as any).default(client, rustplus);
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `alarms`,
                        }),
                        'info',
                    );
                }
                break;

            case 'storagemonitors':
                {
                    await DiscordTools.clearTextChannel(guild!.id, instance.channelId.storageMonitors as string, 100);

                    const perms = PermissionHandler.getPermissionsRemoved(client, guild!);

                    const category = await DiscordTools.getCategoryById(guild!.id, instance.channelId.category as string);
                    await category!.permissionOverwrites.set(perms).catch((e: any) => {
                        client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warning');
                    });

                    const rustplus = (client as any).rustplusInstances[guild!.id];
                    if (rustplus && rustplus.isOperational) {
                        const SetupStorageMonitors = await import('../discordTools/SetupStorageMonitors.js');
                        await (SetupStorageMonitors as any).default(client, rustplus);
                    }

                    await PermissionHandler.resetPermissionsAllChannels(client, guild!);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `storagemonitors`,
                        }),
                        'info',
                    );
                }
                break;

            case 'trackers':
                {
                    const perms = PermissionHandler.getPermissionsRemoved(client, guild!);

                    const category = await DiscordTools.getCategoryById(guild!.id, instance.channelId.category as string);
                    await category!.permissionOverwrites.set(perms).catch((e: any) => {
                        client.log(client.intlGet(null, 'warningCap'), `Failed to set category permissions: ${e.message}`, 'warning');
                    });

                    const SetupTrackers = await import('../discordTools/SetupTrackers.js');
                    await (SetupTrackers as any).default(client, guild);

                    await PermissionHandler.resetPermissionsAllChannels(client, guild!);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `trackers`,
                        }),
                        'info',
                    );
                }
                break;

            default:
                break;
        }

        const str = client.intlGet(interaction.guildId, 'resetSuccess');
        await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(0, str));
        client.log(client.intlGet(null, 'infoCap'), str, 'info');
    },
};