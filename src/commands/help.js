const Builder = require('@discordjs/builders');

const DiscordMessages = require('../discordTools/discordMessages.js');

module.exports = {
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
