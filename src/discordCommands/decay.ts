import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as Timer from '../util/timer.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

export default {
    name: 'decay',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('decay')
            .setDescription(client.intlGet(guildId, 'commandsDecayDesc'))
            .addStringOption((option) =>
                option.setName('name').setDescription(client.intlGet(guildId, 'theNameOfTheItem')).setRequired(false),
            )
            .addStringOption((option) =>
                option.setName('id').setDescription(client.intlGet(guildId, 'theIdOfTheItem')).setRequired(false),
            )
            .addIntegerOption((option) =>
                option.setName('hp').setDescription(client.intlGet(guildId, 'currentItemHp')).setRequired(false),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const decayItemName = interaction.options.getString('name');
        const decayItemId = interaction.options.getString('id');
        const decayItemHp = interaction.options.getInteger('hp');

        let itemId = null;
        let type = 'items';

        if (decayItemName !== null) {
            let foundName = null;
            if (!foundName) {
                foundName = (client as any).rustlabs.getClosestOtherNameByName(decayItemName);
                if (foundName) {
                    if (Object.hasOwn((client as any).rustlabs.decayData['other'], foundName)) {
                        type = 'other';
                    } else {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                foundName = (client as any).rustlabs.getClosestBuildingBlockNameByName(decayItemName);
                if (foundName) {
                    if (Object.hasOwn((client as any).rustlabs.decayData['buildingBlocks'], foundName)) {
                        type = 'buildingBlocks';
                    } else {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                foundName = (client as any).items.getClosestItemIdByName(decayItemName);
                if (foundName) {
                    if (!Object.hasOwn((client as any).rustlabs.decayData['items'], foundName)) {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                const str = client.intlGet(guildId, 'noItemWithNameFound', {
                    name: decayItemName,
                });

                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
                return;
            }
            itemId = foundName;
        } else if (decayItemId !== null) {
            if ((client as any).items.itemExist(decayItemId)) {
                itemId = decayItemId;
            } else {
                const str = client.intlGet(guildId, 'noItemWithIdFound', {
                    id: decayItemId,
                });
                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
                return;
            }
        } else if (decayItemName === null && decayItemId === null) {
            const str = client.intlGet(guildId, 'noNameIdGiven');
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
            return;
        }

        let itemName = null;
        let decayDetails = null;
        if (type === 'items') {
            itemName = (client as any).items.getName(itemId);
            decayDetails = (client as any).rustlabs.getDecayDetailsById(itemId);
        } else {
            itemName = itemId;
            decayDetails = (client as any).rustlabs.getDecayDetailsByName(itemId);
        }

        if (decayDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindDecayDetails', {
                name: itemName,
            });
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
            return;
        }

        const details = decayDetails[3];

        const hp = decayItemHp === null ? details.hp : decayItemHp;
        if (hp > details.hp) {
            const str = client.intlGet(guildId, 'hpExceedMax', {
                hp: hp,
                max: details.hp,
            });
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
            return;
        }

        const decayMultiplier = hp / details.hp;

        let decayString = `${itemName} (${hp}/${details.hp}) `;
        const decayStrings = [];
        if (details.decayString !== null) {
            let str = `${client.intlGet(guildId, 'decay')}: `;
            if (hp === details.hp) {
                decayStrings.push(`${str}${details.decayString}`);
            } else {
                const time = Timer.secondsToFullScale(Math.floor(details.decay * decayMultiplier));
                decayStrings.push(`${str}${time}`);
            }
        }

        if (details.decayOutsideString !== null) {
            let str = `${client.intlGet(guildId, 'outside')}: `;
            if (hp === details.hp) {
                decayStrings.push(`${str}${details.decayOutsideString}`);
            } else {
                const time = Timer.secondsToFullScale(Math.floor(details.decayOutside * decayMultiplier));
                decayStrings.push(`${str}${time}`);
            }
        }

        if (details.decayInsideString !== null) {
            let str = `${client.intlGet(guildId, 'inside')}: `;
            if (hp === details.hp) {
                decayStrings.push(`${str}${details.decayInsideString}`);
            } else {
                const time = Timer.secondsToFullScale(Math.floor(details.decayInside * decayMultiplier));
                decayStrings.push(`${str}${time}`);
            }
        }

        if (details.decayUnderwaterString !== null) {
            let str = `${client.intlGet(guildId, 'underwater')}: `;
            if (hp === details.hp) {
                decayStrings.push(`${str}${details.decayUnderwaterString}`);
            } else {
                const time = Timer.secondsToFullScale(Math.floor(details.decayUnderwater * decayMultiplier));
                decayStrings.push(`${str}${time}`);
            }
        }
        decayString += `${decayStrings.join(', ')}.`;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${decayItemName} ${decayItemId} ${decayItemHp}`,
            }),
            'info',
        );

        await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(0, decayString));
        client.log(client.intlGet(null, 'infoCap'), decayString, 'info');
    },
};