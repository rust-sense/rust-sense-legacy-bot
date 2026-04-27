const Builder = require('@discordjs/builders');
const Utils = require('../util/utils');

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const DiscordMessages = require('../discordTools/discordMessages.js');

export default {
    name: 'recycle',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('recycle')
            .setDescription(client.intlGet(guildId, 'commandsRecycleDesc'))
            .addStringOption((option) =>
                option.setName('name').setDescription(client.intlGet(guildId, 'theNameOfTheItem')).setRequired(false),
            )
            .addStringOption((option) =>
                option.setName('id').setDescription(client.intlGet(guildId, 'theIdOfTheItem')).setRequired(false),
            )
            .addIntegerOption((option) =>
                option
                    .setName('quantity')
                    .setDescription(client.intlGet(guildId, 'commandsRecycleQuantityDesc'))
                    .setRequired(false),
            )
            .addStringOption((option) =>
                option
                    .setName('recycler-type')
                    .setDescription(client.intlGet(guildId, 'commandsRecycleRecyclerTypeDesc'))
                    .setRequired(false)
                    .addChoices(
                        { name: client.intlGet(guildId, 'recycler'), value: 'recycler' },
                        { name: client.intlGet(guildId, 'shredder'), value: 'shredder' },
                        { name: client.intlGet(guildId, 'safe-zone-recycler'), value: 'safe-zone-recycler' },
                    ),
            );
    },

    async execute(client, interaction) {
        const guildId = interaction.guildId;

        const verifyId = Utils.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const recycleItemName = interaction.options.getString('name');
        const recycleItemId = interaction.options.getString('id');
        const recycleItemQuantity = interaction.options.getInteger('quantity');
        const recycleItemRecyclerType = interaction.options.getString('recycler-type');

        const itemId = await Utils.resolveItemId(client, interaction, guildId, recycleItemName, recycleItemId);
        if (itemId === null) return;
        const itemName = client.items.getName(itemId);

        const recycleDetails = client.rustlabs.getRecycleDetailsById(itemId);
        if (recycleDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindRecycleDetails', {
                name: itemName,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }

        const quantity = recycleItemQuantity === null ? 1 : recycleItemQuantity;
        const recyclerType = recycleItemRecyclerType === null ? 'recycler' : recycleItemRecyclerType;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${recycleItemName} ${recycleItemId} ${recycleItemQuantity} ${recycleItemRecyclerType}`,
            }),
        );

        await DiscordMessages.sendRecycleMessage(interaction, recycleDetails, quantity, recyclerType);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsRecycleDesc'));
    },
};
