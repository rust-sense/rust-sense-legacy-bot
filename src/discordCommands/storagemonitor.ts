import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import { getSmartDevice } from '../service/smartDevice.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'storagemonitor',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
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

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);
        const rustplus = client.rustplusInstances[guildId];

        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
                        client.log(client.intlGet(null, 'warningCap'), str, 'warn');
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
                        'info',
                    );

                    if (rustplus && rustplus.serverId === device.serverId) {
                        await DiscordMessages.sendStorageMonitorMessage(guildId, device.serverId, entityId);
                    }

                    const str = client.intlGet(guildId, 'storageMonitorEditSuccess', { name: entity.name });
                    await client.interactionEditReply(
                        interaction,
                        DiscordEmbeds.getActionInfoEmbed(0, str, instance.serverList[device.serverId].title),
                    );
                    client.log(client.intlGet(null, 'infoCap'), str, 'info');
                }
                break;

            default:
                {
                }
                break;
        }
    },
};
