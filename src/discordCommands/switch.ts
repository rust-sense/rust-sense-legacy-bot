// @ts-nocheck
const Builder = require('@discordjs/builders');
const Utils = require('../util/utils');

const DiscordEmbeds = require('../discordTools/discordEmbeds');
const DiscordMessages = require('../discordTools/discordMessages');
const SmartSwitchGroupHandler = require('../handlers/smartSwitchGroupHandler');

import { getSmartDevice } from '../service/smartDevice.js';

export default {
    name: 'switch',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('switch')
            .setDescription(client.intlGet(guildId, 'commandsSwitchDesc'))
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('edit')
                    .setDescription(client.intlGet(guildId, 'commandsSwitchEditDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('id')
                            .setDescription(client.intlGet(guildId, 'commandsSwitchEditIdDesc'))
                            .setRequired(true),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('image')
                            .setDescription(client.intlGet(guildId, 'commandsSwitchEditImageDesc'))
                            .setRequired(true)
                            .addChoices(
                                {
                                    name: client.intlGet(guildId, 'autoturret'),
                                    value: 'autoturret',
                                },
                                {
                                    name: client.intlGet(guildId, 'boomBox'),
                                    value: 'boombox',
                                },
                                {
                                    name: client.intlGet(guildId, 'broadcaster'),
                                    value: 'broadcaster',
                                },
                                {
                                    name: client.intlGet(guildId, 'ceilingLight'),
                                    value: 'ceiling_light',
                                },
                                {
                                    name: client.intlGet(guildId, 'discoFloor'),
                                    value: 'discofloor',
                                },
                                {
                                    name: client.intlGet(guildId, 'doorController'),
                                    value: 'door_controller',
                                },
                                {
                                    name: client.intlGet(guildId, 'elevator'),
                                    value: 'elevator',
                                },
                                {
                                    name: client.intlGet(guildId, 'hbhfSensor'),
                                    value: 'hbhf_sensor',
                                },
                                {
                                    name: client.intlGet(guildId, 'heater'),
                                    value: 'heater',
                                },
                                {
                                    name: client.intlGet(guildId, 'samsite'),
                                    value: 'samsite',
                                },
                                {
                                    name: client.intlGet(guildId, 'sirenLight'),
                                    value: 'siren_light',
                                },
                                {
                                    name: client.intlGet(guildId, 'smartAlarm'),
                                    value: 'smart_alarm',
                                },
                                {
                                    name: client.intlGet(guildId, 'smartSwitch'),
                                    value: 'smart_switch',
                                },
                                {
                                    name: client.intlGet(guildId, 'sprinkler'),
                                    value: 'sprinkler',
                                },
                                {
                                    name: client.intlGet(guildId, 'storageMonitor'),
                                    value: 'storage_monitor',
                                },
                                {
                                    name: client.intlGet(guildId, 'christmasLights'),
                                    value: 'xmas_light',
                                },
                            ),
                    ),
            );
    },

    async execute(client, interaction) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);
        const rustplus = client.rustplusInstances[guildId];

        const verifyId = Utils.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        switch (interaction.options.getSubcommand()) {
            case 'edit':
                {
                    let isSmartSwitchGroup = false;
                    const entityId = interaction.options.getString('id');
                    const image = interaction.options.getString('image');

                    let device = getSmartDevice(guildId, entityId);
                    if (device === null) {
                        isSmartSwitchGroup = true;
                        for (const groupId in instance.serverList[rustplus.serverId].switchGroups) {
                            if (groupId === entityId) {
                                device = {
                                    type: 'switchGroup',
                                    serverId: rustplus.serverId,
                                };
                                break;
                            }
                        }

                        if (device === null) {
                            const str = client.intlGet(guildId, 'invalidId', {
                                id: entityId,
                            });
                            await client.interactionEditReply(
                                interaction,
                                DiscordEmbeds.getActionInfoEmbed(1, str, instance.serverList[rustplus.serverId].title),
                            );
                            client.log(client.intlGet(null, 'warningCap'), str);
                            return;
                        }
                    }

                    const entity = isSmartSwitchGroup
                        ? instance.serverList[device.serverId].switchGroups[entityId]
                        : instance.serverList[device.serverId].switches[entityId];

                    if (image !== null) {
                        if (isSmartSwitchGroup) {
                            instance.serverList[device.serverId].switchGroups[entityId].image = `${image}.png`;
                        } else {
                            instance.serverList[device.serverId].switches[entityId].image = `${image}.png`;
                        }
                    }
                    client.setInstance(guildId, instance);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `edit, ${entityId}, ${image}.png`,
                        }),
                    );

                    if (rustplus && rustplus.serverId === device.serverId) {
                        if (isSmartSwitchGroup) {
                            DiscordMessages.sendSmartSwitchGroupMessage(guildId, device.serverId, entityId);
                        } else {
                            DiscordMessages.sendSmartSwitchMessage(guildId, device.serverId, entityId);
                            SmartSwitchGroupHandler.updateSwitchGroupIfContainSwitch(
                                client,
                                guildId,
                                device.serverId,
                                entityId,
                            );
                        }
                    }

                    const str = client.intlGet(guildId, 'smartSwitchEditSuccess', {
                        name: entity.name,
                    });
                    await client.interactionEditReply(
                        interaction,
                        DiscordEmbeds.getActionInfoEmbed(0, str, instance.serverList[device.serverId].title),
                    );
                    client.log(client.intlGet(null, 'infoCap'), str);
                }
                break;

            default:
                {
                }
                break;
        }
    },
};
