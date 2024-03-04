import Builder from '@discordjs/builders';

import { ChatInputCommandInteraction, Guild } from 'discord.js';
import DiscordBot from '../core/DiscordBot.js';
import DiscordCommand from '../core/abstract/DiscordCommand.js';
import DiscordEmbeds from '../discordTools/discordEmbeds.js';

export default class UpkeepCommand extends DiscordCommand {
    constructor() {
        super('upkeep');
    }

    async builder(client: DiscordBot, guild: Guild) {
        const guildId = guild.id;
        return new Builder.SlashCommandBuilder()
            .setName('upkeep')
            .setDescription(client.intlGet(guildId, 'commandsUpkeepDesc'))
            .addStringOption((option) =>
                option.setName('name').setDescription(client.intlGet(guildId, 'theNameOfTheItem')).setRequired(false),
            )
            .addStringOption((option) =>
                option.setName('id').setDescription(client.intlGet(guildId, 'theIdOfTheItem')).setRequired(false),
            );
    }

    async execute(client: DiscordBot, interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId;

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const upkeepItemName = interaction.options.getString('name');
        const upkeepItemId = interaction.options.getString('id');

        let itemId = null;
        let type = 'items';

        if (upkeepItemName !== null) {
            let foundName = null;
            if (!foundName) {
                foundName = client.rustlabs.getClosestOtherNameByName(upkeepItemName);
                if (foundName) {
                    if (client.rustlabs.upkeepData['other'].hasOwn(foundName)) {
                        type = 'other';
                    } else {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                foundName = client.rustlabs.getClosestBuildingBlockNameByName(upkeepItemName);
                if (foundName) {
                    if (client.rustlabs.upkeepData['buildingBlocks'].hasOwn(foundName)) {
                        type = 'buildingBlocks';
                    } else {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                foundName = client.items.getClosestItemIdByName(upkeepItemName);
                if (foundName) {
                    if (!client.rustlabs.upkeepData['items'].hasOwn(foundName)) {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                const str = client.intlGet(guildId, 'noItemWithNameFound', {
                    name: upkeepItemName,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            }
            itemId = foundName;
        } else if (upkeepItemId !== null) {
            if (client.items.itemExist(upkeepItemId)) {
                itemId = upkeepItemId;
            } else {
                const str = client.intlGet(guildId, 'noItemWithIdFound', {
                    id: upkeepItemId,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            }
        } else if (upkeepItemName === null && upkeepItemId === null) {
            const str = client.intlGet(guildId, 'noNameIdGiven');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }

        let itemName = null;
        let upkeepDetails = null;
        if (type === 'items') {
            itemName = client.items.getName(itemId);
            upkeepDetails = client.rustlabs.getUpkeepDetailsById(itemId);
        } else {
            itemName = itemId;
            upkeepDetails = client.rustlabs.getUpkeepDetailsByName(itemId);
        }

        if (upkeepDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindUpkeepDetails', {
                name: itemName,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }

        const details = upkeepDetails[3];

        const items = [];
        for (const item of details) {
            const name = client.items.getName(item.id);
            const quantity = item.quantity;
            items.push(`${quantity} ${name}`);
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${upkeepItemName} ${upkeepItemId}`,
            }),
        );

        const str = client.intlGet(guildId, 'upkeepForItem', {
            item: itemName,
            cost: items.join(', '),
        });

        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
        client.log(client.intlGet(null, 'infoCap'), str);
    }
}
