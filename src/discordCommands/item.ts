import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

export default {
    name: 'item',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('item')
            .setDescription(client.intlGet(guildId, 'commandsItemDesc'))
            .addStringOption((option) =>
                option.setName('name').setDescription(client.intlGet(guildId, 'theNameOfTheItem')).setRequired(false),
            )
            .addStringOption((option) =>
                option.setName('id').setDescription(client.intlGet(guildId, 'theIdOfTheItem')).setRequired(false),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const itemItemName = interaction.options.getString('name');
        const itemItemId = interaction.options.getString('id');

        let itemId = null;
        let type = null;

        if (itemItemName !== null) {
            let foundName = null;
            if (!foundName) {
                foundName = (client as any).rustlabs.getClosestOtherNameByName(itemItemName);
                if (foundName) {
                    type = 'other';
                }
            }

            if (!foundName) {
                foundName = (client as any).rustlabs.getClosestBuildingBlockNameByName(itemItemName);
                if (foundName) {
                    type = 'buildingBlocks';
                }
            }

            if (!foundName) {
                foundName = (client as any).items.getClosestItemIdByName(itemItemName);
                if (foundName) {
                    type = 'items';
                }
            }

            if (!foundName) {
                const str = client.intlGet(guildId, 'noItemWithNameFound', {
                    name: itemItemName,
                });
                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
                return;
            }
            itemId = foundName;
        } else if (itemItemId !== null) {
            if ((client as any).items.itemExist(itemItemId)) {
                itemId = itemItemId;
            } else {
                const str = client.intlGet(guildId, 'noItemWithIdFound', {
                    id: itemItemId,
                });
                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
                return;
            }
        } else if (itemItemName === null && itemItemId === null) {
            const str = client.intlGet(guildId, 'noNameIdGiven');
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
            return;
        }
        let itemName = null;
        if (type === 'items') {
            itemName = (client as any).items.getName(itemId);
        } else {
            itemName = itemId;
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${itemItemName} ${itemItemId}`,
            }),
            'info',
        );

        await DiscordMessages.sendItemMessage(interaction, itemName, itemId, type);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsItemDesc'), 'info');
    },
};