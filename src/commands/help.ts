import Builder from '@discordjs/builders';

import DiscordMessages from '../discordTools/discordMessages.js';

export default {
    name: 'help',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('help')
            .setDescription(client.intlGet(guildId, 'commandsHelpDesc'));
    },

    async execute(client, interaction) {
        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;

        await DiscordMessages.sendHelpMessage(interaction);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(interaction.guildId, 'commandsHelpDesc'));
    },
};
