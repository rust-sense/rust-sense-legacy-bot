import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';

import * as DiscordMessages from '../discordTools/discordMessages.js';
import type DiscordBot from '../structures/DiscordBot.js';
import * as Timer from '../util/timer.js';

export default {
    name: 'uptime',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('uptime')
            .setDescription(client.intlGet(guildId, 'commandsUptimeDesc'))
            .addSubcommand((subcommand) =>
                subcommand.setName('bot').setDescription(client.intlGet(guildId, 'commandsUptimeBotDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('server').setDescription(client.intlGet(guildId, 'commandsUptimeServerDesc')),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const rustplus = client.rustplusInstances[interaction.guildId];

        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let string = '';
        switch (interaction.options.getSubcommand()) {
            case 'bot':
                {
                    if (client.uptimeBot === null) {
                        string = client.intlGet(interaction.guildId, 'offline');
                    } else {
                        const seconds = (new Date().getTime() - client.uptimeBot.getTime()) / 1000;
                        string = Timer.secondsToFullScale(seconds);
                    }
                }
                break;

            case 'server':
                {
                    if (!rustplus || (rustplus && rustplus.uptimeServer === null)) {
                        string = client.intlGet(interaction.guildId, 'offline');
                        break;
                    }

                    const seconds = (new Date().getTime() - rustplus.uptimeServer.getTime()) / 1000;
                    string = Timer.secondsToFullScale(seconds);
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

        await DiscordMessages.sendUptimeMessage(interaction, string);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(interaction.guildId, 'commandsUptimeDesc'), 'info');
    },
};
