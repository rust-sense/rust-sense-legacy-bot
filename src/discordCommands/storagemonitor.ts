// @ts-nocheck
const Builder = require('@discordjs/builders');
const Utils = require('../util/utils');

const DiscordEmbeds = require('../discordTools/discordEmbeds');
const DiscordMessages = require('../discordTools/discordMessages');

import { getSmartDevice } from '../service/smartDevice.js';

export default {
    name: 'storagemonitor',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('storagemonitor')
            .setDescription(client.intlGet(guildId, 'commandsStoragemonitorDesc'))
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('edit')
                    .setDescription(client.intlGet(guildId, 'commandsStoragemonitorEditDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('id')
                            .setDescription(client.intlGet(guildId, 'commandsStoragemonitorEditIdDesc'))
                            .setRequired(true),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('image')
                            .setDescription(client.intlGet(guildId, 'commandsStoragemonitorEditImageDesc'))
                            .setRequired(true)
                            .addChoices(
                                {
                                    name: client.intlGet(guildId, 'storageMonitor'),
                                    value: 'storage_monitor',
                                },
                                {
                                    name: client.intlGet(guildId, 'toolCupboard'),
                                    value: 'tool_cupboard',
                                },
                                {
                                    name: client.intlGet(guildId, 'largeWoodBox'),
                                    value: 'large_wood_box',
                                },
                                {
                                    name: client.intlGet(guildId, 'vendingMachine'),
                                    value: 'vending_machine',
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
                    const entityId = interaction.options.getString('id');
                    const image = interaction.options.getString('image');

                    const device = getSmartDevice(guildId, entityId);
                    if (device === null) {
                        const str = client.intlGet(guildId, 'invalidId', {
                            id: entityId,
                        });
                        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                        client.log(client.intlGet(null, 'warningCap'), str);
                        return;
                    }

                    const entity = instance.serverList[device.serverId].storageMonitors[entityId];

                    if (image !== null) {
                        instance.serverList[device.serverId].storageMonitors[entityId].image = `${image}.png`;
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
                        await DiscordMessages.sendStorageMonitorMessage(guildId, device.serverId, entityId);
                    }

                    const str = client.intlGet(guildId, 'storageMonitorEditSuccess', { name: entity.name });
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
