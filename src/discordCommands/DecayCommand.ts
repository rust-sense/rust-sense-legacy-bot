import Builder from '@discordjs/builders';

import { ChatInputCommandInteraction, Guild } from 'discord.js';
import DiscordBot from '../core/DiscordBot.js';
import DiscordCommand from '../core/abstract/DiscordCommand.js';
import DiscordEmbeds from '../discordTools/discordEmbeds.js';
import Timer from '../util/timer.js';

export default class DecayCommand extends DiscordCommand {
    constructor() {
        super('decay');
    }

    async builder(client: DiscordBot, guild: Guild) {
        const guildId = guild.id;
        return new Builder.SlashCommandBuilder()
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
    }

    async execute(client: DiscordBot, interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId;

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const decayItemName = interaction.options.getString('name');
        const decayItemId = interaction.options.getString('id');
        const decayItemHp = interaction.options.getInteger('hp');

        let itemId = null;
        let type = 'items';

        if (decayItemName !== null) {
            let foundName = null;
            if (!foundName) {
                foundName = client.rustlabs.getClosestOtherNameByName(decayItemName);
                if (foundName) {
                    if (client.rustlabs.decayData['other'].hasOwn(foundName)) {
                        type = 'other';
                    } else {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                foundName = client.rustlabs.getClosestBuildingBlockNameByName(decayItemName);
                if (foundName) {
                    if (client.rustlabs.decayData['buildingBlocks'].hasOwn(foundName)) {
                        type = 'buildingBlocks';
                    } else {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                foundName = client.items.getClosestItemIdByName(decayItemName);
                if (foundName) {
                    if (!client.rustlabs.decayData['items'].hasOwn(foundName)) {
                        foundName = null;
                    }
                }
            }

            if (!foundName) {
                const str = client.intlGet(guildId, 'noItemWithNameFound', {
                    name: decayItemName,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            }
            itemId = foundName;
        } else if (decayItemId !== null) {
            if (client.items.itemExist(decayItemId)) {
                itemId = decayItemId;
            } else {
                const str = client.intlGet(guildId, 'noItemWithIdFound', {
                    id: decayItemId,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            }
        } else if (decayItemName === null && decayItemId === null) {
            const str = client.intlGet(guildId, 'noNameIdGiven');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }

        let itemName = null;
        let decayDetails = null;
        if (type === 'items') {
            itemName = client.items.getName(itemId);
            decayDetails = client.rustlabs.getDecayDetailsById(itemId);
        } else {
            itemName = itemId;
            decayDetails = client.rustlabs.getDecayDetailsByName(itemId);
        }

        if (decayDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindDecayDetails', {
                name: itemName,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }

        const details = decayDetails[3];

        const hp = decayItemHp === null ? details.hp : decayItemHp;

        if (hp > details.hp) {
            const str = client.intlGet(guildId, 'hpExceedMax', {
                hp: hp,

                max: details.hp,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }

        const decayMultiplier = hp / details.hp;

        let decayString = `${itemName} (${hp}/${details.hp}) `;
        const decayStrings = [];

        if (details.decayString !== null) {
            const str = `${client.intlGet(guildId, 'decay')}: `;

            if (hp === details.hp) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                decayStrings.push(`${str}${details.decayString}`);
            } else {
                const time = Timer.secondsToFullScale(Math.floor(details.decay * decayMultiplier));
                // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                decayStrings.push(`${str}${time}`);
            }
        }

        if (details.decayOutsideString !== null) {
            const str = `${client.intlGet(guildId, 'outside')}: `;

            if (hp === details.hp) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                decayStrings.push(`${str}${details.decayOutsideString}`);
            } else {
                const time = Timer.secondsToFullScale(Math.floor(details.decayOutside * decayMultiplier));
                // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                decayStrings.push(`${str}${time}`);
            }
        }

        if (details.decayInsideString !== null) {
            const str = `${client.intlGet(guildId, 'inside')}: `;

            if (hp === details.hp) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                decayStrings.push(`${str}${details.decayInsideString}`);
            } else {
                const time = Timer.secondsToFullScale(Math.floor(details.decayInside * decayMultiplier));
                // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                decayStrings.push(`${str}${time}`);
            }
        }

        if (details.decayUnderwaterString !== null) {
            const str = `${client.intlGet(guildId, 'underwater')}: `;

            if (hp === details.hp) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                decayStrings.push(`${str}${details.decayUnderwaterString}`);
            } else {
                const time = Timer.secondsToFullScale(Math.floor(details.decayUnderwater * decayMultiplier));
                // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
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
        );

        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, decayString));
        client.log(client.intlGet(null, 'infoCap'), decayString);
    }
}
