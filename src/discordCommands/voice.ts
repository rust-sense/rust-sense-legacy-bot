import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';

import * as DiscordMessages from '../discordTools/discordMessages.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'voice',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('voice')
            .setDescription(client.intlGet(guildId, 'commandsVoiceDesc'))
            .addSubcommand((subcommand) =>
                subcommand.setName('join').setDescription(client.intlGet(guildId, 'commandsVoiceJoinDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('leave').setDescription(client.intlGet(guildId, 'commandsVoiceLeaveDesc')),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        switch (interaction.options.getSubcommand()) {
            case 'join':
                {
                    const voiceState = interaction.member.voice;
                    if (voiceState && voiceState.channel) {
                        const voiceChannelId = voiceState.channel.id;
                        const voiceChannel = interaction.guild.channels.cache.get(voiceChannelId);
                        const connection = joinVoiceChannel({
                            channelId: voiceChannel.id,
                            guildId: interaction.guild.id,
                            adapterCreator: interaction.guild.voiceAdapterCreator,
                        });
                        await DiscordMessages.sendVoiceMessage(
                            interaction,
                            client.intlGet(interaction.guildId, 'commandsVoiceBotJoinedVoice'),
                        );
                        client.log(
                            client.intlGet(null, 'infoCap'),
                            client.intlGet(interaction.guildId, 'commandsVoiceJoin', {
                                name:
                                    voiceChannel && voiceChannel.name
                                        ? voiceChannel.name
                                        : client.intlGet(interaction.guildId, 'unknown'),
                                id:
                                    voiceChannel && voiceChannel.id
                                        ? voiceChannel.id
                                        : client.intlGet(interaction.guildId, 'unknown'),
                                guild:
                                    voiceChannel && voiceChannel.guild.name
                                        ? voiceChannel.guild.name
                                        : client.intlGet(interaction.guildId, 'unknown'),
                            }),
                            'info',
                        );
                    } else {
                        await DiscordMessages.sendVoiceMessage(
                            interaction,
                            client.intlGet(interaction.guildId, 'commandsVoiceNotInVoice'),
                        );
                    }
                }
                break;

            case 'leave':
                {
                    const connection = getVoiceConnection(interaction.guild.id);
                    if (connection) {
                        connection.destroy();
                        await DiscordMessages.sendVoiceMessage(
                            interaction,
                            client.intlGet(interaction.guildId, 'commandsVoiceBotLeftVoice'),
                        );
                        client.log(
                            client.intlGet(null, 'infoCap'),
                            client.intlGet(interaction.guildId, 'commandsVoiceLeave', {
                                name: interaction.member.voice.channel.name,
                                id: interaction.member.voice.channel.id,
                                guild: interaction.member.guild.name,
                            }),
                            'info',
                        );
                    }
                }
                break;

            default:
                {
                }
                break;
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${interaction.options.getSubcommand()}`,
            }),
            'info',
        );
    },
};