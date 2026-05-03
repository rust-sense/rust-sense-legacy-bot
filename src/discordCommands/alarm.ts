import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import { getPersistenceCache } from '../persistence/index.js';
import { getSmartDevice } from '../services/smartDevice.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'alarm',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('alarm')
            .setDescription(client.intlGet(guildId, 'commandsAlarmDesc'))
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('edit')
                    .setDescription(client.intlGet(guildId, 'commandsAlarmEditDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('id')
                            .setDescription(client.intlGet(guildId, 'commandsAlarmEditIdDesc'))
                            .setRequired(true),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('image')
                            .setDescription(client.intlGet(guildId, 'commandsAlarmEditImageDesc'))
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

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;
        const instance = await getPersistenceCache().readGuildState(guildId);

        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        switch (interaction.options.getSubcommand()) {
            case 'edit':
                {
                    const entityId = interaction.options.getString('id');
                    const image = interaction.options.getString('image');

                    const device = await getSmartDevice(guildId, entityId);
                    if (device === null) {
                        const str = client.intlGet(guildId, 'invalidId', {
                            id: entityId,
                        });
                        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                        client.log(client.intlGet(null, 'warningCap'), str, 'warn');
                        return;
                    }

                    const entity = instance.serverList[device.serverId].alarms[entityId];

                    if (image !== null) instance.serverList[device.serverId].alarms[entityId].image = `${image}.png`;
                    await getPersistenceCache().saveGuildStateChanges(guildId, instance);

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `edit, ${entityId}, ${image}.png`,
                        }),
                        'info',
                    );

                    await DiscordMessages.sendSmartAlarmMessage(guildId, device.serverId, entityId);

                    const str = client.intlGet(guildId, 'smartAlarmEditSuccess', { name: entity.name });
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
