import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

export default {
    name: 'upkeep',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('upkeep')
            .setDescription(client.intlGet(guildId, 'commandsUpkeepDesc'))
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

        const upkeepItemName = interaction.options.getString('name');
        const upkeepItemId = interaction.options.getString('id');

        let itemId = null;
        let type = 'items';

        if (upkeepItemName !== null) {
            let foundName = null;
            if (!foundName) {
                foundName = (client as any).rustlabs.getClosestOtherNameByName(upkeepItemName);
                if (foundName) {
                    if ((client as any).rustlabs.upkeepData['other'].hasOwnProperty(foundName)) {
                        type = 'other';
                    } else {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                foundName = (client as any).rustlabs.getClosestBuildingBlockNameByName(upkeepItemName);
                if (foundName) {
                    if ((client as any).rustlabs.upkeepData['buildingBlocks'].hasOwnProperty(foundName)) {
                        type = 'buildingBlocks';
                    } else {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                foundName = (client as any).items.getClosestItemIdByName(upkeepItemName);
                if (foundName) {
                    if (!(client as any).rustlabs.upkeepData['items'].hasOwnProperty(foundName)) {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                const str = client.intlGet(guildId, 'noItemWithNameFound', {
                    name: upkeepItemName,
                });
                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
                return;
            }
            itemId = foundName;
        } else if (upkeepItemId !== null) {
            if ((client as any).items.itemExist(upkeepItemId)) {
                itemId = upkeepItemId;
            } else {
                const str = client.intlGet(guildId, 'noItemWithIdFound', {
                    id: upkeepItemId,
                });
                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
                return;
            }
        } else if (upkeepItemName === null && upkeepItemId === null) {
            const str = client.intlGet(guildId, 'noNameIdGiven');
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
            return;
        }

        let itemName = null;
        let upkeepDetails = null;
        if (type === 'items') {
            itemName = (client as any).items.getName(itemId);
            upkeepDetails = (client as any).rustlabs.getUpkeepDetailsById(itemId);
        } else {
            itemName = itemId;
            upkeepDetails = (client as any).rustlabs.getUpkeepDetailsByName(itemId);
        }

        if (upkeepDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindUpkeepDetails', {
                name: itemName,
            });
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
            return;
        }

        const details = upkeepDetails[3];

        const items = [];
        for (const item of details) {
            const name = (client as any).items.getName(item.id);
            const quantity = item.quantity;
            items.push(`${quantity} ${name}`);
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${upkeepItemName} ${upkeepItemId}`,
            }),
            'info',
        );

        const str = client.intlGet(guildId, 'upkeepForItem', {
            item: itemName,
            cost: items.join(', '),
        });

        await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(0, str));
        client.log(client.intlGet(null, 'infoCap'), str, 'info');
    },
};