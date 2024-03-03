import Builder from '@discordjs/builders';

// @ts-expect-error TS(2307) FIXME: Cannot find module '../../config' or its correspon... Remove this comment to see the full error message
import DiscordEmbeds from '../discordTools/discordEmbeds.js';
import DiscordMessages from '../discordTools/discordMessages.js';
import DiscordTools from '../discordTools/discordTools.js';
import PermissionHandler from '../handlers/permissionHandler.js';

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

        const verifyId = Math.floor(100000 + Math.random() * 900000);
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
                    await category.permissionOverwrites.set(perms).catch((e) => {});

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
                    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
                    await category.permissionOverwrites.set(perms).catch((e) => {});

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
                    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
                    await category.permissionOverwrites.set(perms).catch((e) => {});

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
                    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
                    await category.permissionOverwrites.set(perms).catch((e) => {});

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
                    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
                    await category.permissionOverwrites.set(perms).catch((e) => {});

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
                    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
                    await category.permissionOverwrites.set(perms).catch((e) => {});

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
