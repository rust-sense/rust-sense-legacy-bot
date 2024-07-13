const Builder = require('@discordjs/builders');

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const DiscordMessages = require('../discordTools/discordMessages.js');

module.exports = {
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
            );
    },

    async execute(client, interaction) {
        const guildId = interaction.guildId;

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const recycleItemName = interaction.options.getString('name');
        const recycleItemId = interaction.options.getString('id');
        const recycleItemQuantity = interaction.options.getInteger('quantity');

        let itemId = null;
        if (recycleItemName !== null) {
            const item = client.items.getClosestItemIdByName(recycleItemName);
            if (item === null) {
                const str = client.intlGet(guildId, 'noItemWithNameFound', {
                    name: recycleItemName,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            } else {
                itemId = item;
            }
        } else if (recycleItemId !== null) {
            if (client.items.itemExist(recycleItemId)) {
                itemId = recycleItemId;
            } else {
                const str = client.intlGet(guildId, 'noItemWithIdFound', {
                    id: recycleItemId,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            }
        } else if (recycleItemName === null && recycleItemId === null) {
            const str = client.intlGet(guildId, 'noNameIdGiven');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }
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

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${recycleItemName} ${recycleItemId} ${recycleItemQuantity}`,
            }),
        );

        await DiscordMessages.sendRecycleMessage(interaction, recycleDetails, quantity);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsRecycleDesc'));
    },
};
