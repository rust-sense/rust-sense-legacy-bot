import Builder from '@discordjs/builders';

import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';
import DiscordBot from '../core/DiscordBot.js';
import DiscordCommand from '../core/abstract/DiscordCommand.js';
import DiscordMessages from '../discordTools/discordMessages.js';

export default class VoiceCommand extends DiscordCommand {
    constructor() {
        super('voice');
    }

    async builder(client: DiscordBot, guild: Guild) {
        const guildId = guild.id;
        return new Builder.SlashCommandBuilder()
            .setName('voice')
            .setDescription(client.intlGet(guildId, 'commandsVoiceDesc'))
            .addSubcommand((subcommand) =>
                subcommand.setName('join').setDescription(client.intlGet(guildId, 'commandsVoiceJoinDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('leave').setDescription(client.intlGet(guildId, 'commandsVoiceLeaveDesc')),
            );
    }

    async execute(client: DiscordBot, interaction: ChatInputCommandInteraction) {
        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        if (interaction.guild === null) return;

        switch (interaction.options.getSubcommand()) {
            case 'join':
                {
                    const voiceState = (interaction.member as GuildMember).voice;
                    if (voiceState && voiceState.channel) {
                        const voiceChannel = voiceState.channel;

                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                                name: voiceChannel.name,
                                id: voiceChannel.id,
                                guild: voiceChannel.guild.name,
                            }),
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
                        );
                    }
                }
                break;

            default:
                break;
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${interaction.options.getSubcommand()}`,
            }),
        );
    }
}
