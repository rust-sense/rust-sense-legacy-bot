const Builder = require('@discordjs/builders');
const Utils = require('../util/utils');

const DiscordEmbeds = require('../discordTools/discordEmbeds');
const DiscordMessages = require('../discordTools/discordMessages');

export default {
    name: 'research',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('research')
            .setDescription(client.intlGet(guildId, 'commandsResearchDesc'))
            .addStringOption((option) =>
                option.setName('name').setDescription(client.intlGet(guildId, 'theNameOfTheItem')).setRequired(false),
            )
            .addStringOption((option) =>
                option.setName('id').setDescription(client.intlGet(guildId, 'theIdOfTheItem')).setRequired(false),
            );
    },

    async execute(client, interaction) {
        const guildId = interaction.guildId;

        const verifyId = Utils.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const researchItemName = interaction.options.getString('name');
        const researchItemId = interaction.options.getString('id');

        const itemId = await Utils.resolveItemId(client, interaction, guildId, researchItemName, researchItemId);
        if (itemId === null) return;
        const itemName = client.items.getName(itemId);

        const researchDetails = client.rustlabs.getResearchDetailsById(itemId);
        if (researchDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindResearchDetails', {
                name: itemName,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${researchItemName} ${researchItemId}`,
            }),
        );

        await DiscordMessages.sendResearchMessage(interaction, researchDetails);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsResearchDesc'));
    },
};
