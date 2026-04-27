const Builder = require('@discordjs/builders');
const Utils = require('../util/utils');

const DiscordMessages = require('../discordTools/discordMessages');

export default {
    name: 'help',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('help')
            .setDescription(client.intlGet(guildId, 'commandsHelpDesc'));
    },

    async execute(client, interaction) {
        const verifyId = Utils.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;

        await DiscordMessages.sendHelpMessage(interaction);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(interaction.guildId, 'commandsHelpDesc'));
    },
};
