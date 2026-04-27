const Builder = require('@discordjs/builders');
const Utils = require('../util/utils');

const DiscordEmbeds = require('../discordTools/discordEmbeds');
const DiscordMessages = require('../discordTools/discordMessages');

export default {
    name: 'item',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('item')
            .setDescription(client.intlGet(guildId, 'commandsItemDesc'))
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

        const itemItemName = interaction.options.getString('name');
        const itemItemId = interaction.options.getString('id');

        let itemId = null;
        let type = null;

        if (itemItemName !== null) {
            let foundName = null;
            if (!foundName) {
                foundName = client.rustlabs.getClosestOtherNameByName(itemItemName);
                if (foundName) {
                    type = 'other';
                }
            }

            if (!foundName) {
                foundName = client.rustlabs.getClosestBuildingBlockNameByName(itemItemName);
                if (foundName) {
                    type = 'buildingBlocks';
                }
            }

            if (!foundName) {
                foundName = client.items.getClosestItemIdByName(itemItemName);
                if (foundName) {
                    type = 'items';
                }
            }

            if (!foundName) {
                const str = client.intlGet(guildId, 'noItemWithNameFound', {
                    name: itemItemName,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            }
            itemId = foundName;
        } else if (itemItemId !== null) {
            if (client.items.itemExist(itemItemId)) {
                itemId = itemItemId;
            } else {
                const str = client.intlGet(guildId, 'noItemWithIdFound', {
                    id: itemItemId,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            }
        } else if (itemItemName === null && itemItemId === null) {
            const str = client.intlGet(guildId, 'noNameIdGiven');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }
        let itemName = null;
        if (type === 'items') {
            itemName = client.items.getName(itemId);
        } else {
            itemName = itemId;
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${itemItemName} ${itemItemId}`,
            }),
        );

        await DiscordMessages.sendItemMessage(interaction, itemName, itemId, type);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsItemDesc'));
    },
};
