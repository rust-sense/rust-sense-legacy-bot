import Builder from '@discordjs/builders';

import DiscordMessages from '../discordTools/discordMessages.js';
import Timer from '../util/timer.js';

export default {
    name: 'uptime',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('uptime')
            .setDescription(client.intlGet(guildId, 'commandsUptimeDesc'))
            .addSubcommand((subcommand) =>
                subcommand.setName('bot').setDescription(client.intlGet(guildId, 'commandsUptimeBotDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('server').setDescription(client.intlGet(guildId, 'commandsUptimeServerDesc')),
            );
    },

    async execute(client, interaction) {
        const rustplus = client.rustplusInstances[interaction.guildId];

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        let string = '';
        switch (interaction.options.getSubcommand()) {
            case 'bot':
                {
                    if (client.uptimeBot === null) {
                        string = client.intlGet(interaction.guildId, 'offline');
                    } else {
                        // @ts-expect-error TS(2362) FIXME: The left-hand side of an arithmetic operation must... Remove this comment to see the full error message
                        const seconds = (new Date() - client.uptimeBot) / 1000;
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

                    // @ts-expect-error TS(2362) FIXME: The left-hand side of an arithmetic operation must... Remove this comment to see the full error message
                    const seconds = (new Date() - rustplus.uptimeServer) / 1000;
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
        );

        await DiscordMessages.sendUptimeMessage(interaction, string);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(interaction.guildId, 'commandsUptimeDesc'));
    },
};
