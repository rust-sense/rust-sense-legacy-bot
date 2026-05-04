import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as Constants from '../domain/constants.js';
import { getPersistenceCache } from '../persistence/index.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'market',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('market')
            .setDescription(client.intlGet(guildId, 'commandsMarketDesc'))
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('search')
                    .setDescription(client.intlGet(guildId, 'commandsMarketSearchDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('order')
                            .setDescription(client.intlGet(guildId, 'commandsMarketOrderDesc'))
                            .setRequired(true)
                            .addChoices(
                                { name: client.intlGet(guildId, 'all'), value: 'all' },
                                { name: client.intlGet(guildId, 'buy'), value: 'buy' },
                                { name: client.intlGet(guildId, 'sell'), value: 'sell' },
                            ),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('name')
                            .setDescription(client.intlGet(guildId, 'theNameOfTheItem'))
                            .setRequired(false),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('id')
                            .setDescription(client.intlGet(guildId, 'theIdOfTheItem'))
                            .setRequired(false),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('subscribe')
                    .setDescription(client.intlGet(guildId, 'commandsMarketSubscribeDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('order')
                            .setDescription(client.intlGet(guildId, 'commandsMarketOrderDesc'))
                            .setRequired(true)
                            .addChoices(
                                { name: client.intlGet(guildId, 'all'), value: 'all' },
                                { name: client.intlGet(guildId, 'buy'), value: 'buy' },
                                { name: client.intlGet(guildId, 'sell'), value: 'sell' },
                            ),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('name')
                            .setDescription(client.intlGet(guildId, 'theNameOfTheItem'))
                            .setRequired(false),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('id')
                            .setDescription(client.intlGet(guildId, 'theIdOfTheItem'))
                            .setRequired(false),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('unsubscribe')
                    .setDescription(client.intlGet(guildId, 'commandsMarketUnsubscribeDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('order')
                            .setDescription(client.intlGet(guildId, 'commandsMarketOrderDesc'))
                            .setRequired(true)
                            .addChoices(
                                { name: client.intlGet(guildId, 'all'), value: 'all' },
                                { name: client.intlGet(guildId, 'buy'), value: 'buy' },
                                { name: client.intlGet(guildId, 'sell'), value: 'sell' },
                            ),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('name')
                            .setDescription(client.intlGet(guildId, 'theNameOfTheItem'))
                            .setRequired(false),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('id')
                            .setDescription(client.intlGet(guildId, 'theIdOfTheItem'))
                            .setRequired(false),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('list').setDescription(client.intlGet(guildId, 'commandsMarketListDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('blacklist')
                    .setDescription(client.intlGet(guildId, 'commandsMarketBlaclistDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('choice')
                            .setDescription(client.intlGet(guildId, 'commandsAddOrRemove'))
                            .setRequired(true)
                            .addChoices(
                                { name: client.intlGet(guildId, 'add'), value: 'add' },
                                { name: client.intlGet(guildId, 'remove'), value: 'remove' },
                                { name: client.intlGet(guildId, 'show'), value: 'show' },
                            ),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('name')
                            .setDescription(client.intlGet(guildId, 'theNameOfTheVendingMachine'))
                            .setRequired(false),
                    ),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const instance = await getPersistenceCache().readGuildState(interaction.guildId);
        const rustplus = client.rustplusInstances[interaction.guildId];

        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!rustplus || (rustplus && !rustplus.isOperational)) {
            const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warn');
            return;
        }

        switch (interaction.options.getSubcommand()) {
            case 'search':
                {
                    const searchItemName = interaction.options.getString('name');
                    const searchItemId = interaction.options.getString('id');
                    const orderType = interaction.options.getString('order');

                    let itemId = null;
                    if (searchItemName !== null) {
                        const item = client.items.getClosestItemIdByName(searchItemName);
                        if (item === null) {
                            const str = client.intlGet(interaction.guildId, 'noItemWithNameFound', {
                                name: searchItemName,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                            return;
                        } else {
                            itemId = item;
                        }
                    } else if (searchItemId !== null) {
                        if (client.items.itemExist(searchItemId)) {
                            itemId = searchItemId;
                        } else {
                            const str = client.intlGet(interaction.guildId, 'noItemWithIdFound', {
                                id: searchItemId,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                            return;
                        }
                    } else if (searchItemName === null && searchItemId === null) {
                        const str = client.intlGet(interaction.guildId, 'noNameIdGiven');
                        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                        rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                        return;
                    }
                    const itemName = client.items.getName(itemId);

                    let full = false;
                    let foundLines = '';
                    const unknownString = client.intlGet(interaction.guildId, 'unknown');
                    const leftString = client.intlGet(interaction.guildId, 'remain');
                    for (const vendingMachine of rustplus.mapMarkers.vendingMachines) {
                        if (full) break;

                        if (!Object.hasOwn(vendingMachine, 'sellOrders')) {
                            continue;
                        }

                        for (const order of vendingMachine.sellOrders) {
                            if (order.amountInStock === 0) continue;

                            const orderItemId = Object.keys(client.items.items).includes(order.itemId.toString())
                                ? order.itemId
                                : null;
                            const orderQuantity = order.quantity;
                            const orderCurrencyId = Object.keys(client.items.items).includes(
                                order.currencyId.toString(),
                            )
                                ? order.currencyId
                                : null;
                            const orderCostPerItem = order.costPerItem;
                            const orderAmountInStock = order.amountInStock;
                            const orderItemIsBlueprint = order.itemIsBlueprint;
                            const orderCurrencyIsBlueprint = order.currencyIsBlueprint;

                            const orderItemName =
                                orderItemId !== null ? client.items.getName(orderItemId) : unknownString;
                            const orderCurrencyName =
                                orderCurrencyId !== null ? client.items.getName(orderCurrencyId) : unknownString;

                            const prevFoundLines = foundLines;

                            if (
                                (orderType === 'all' &&
                                    (orderItemId === parseInt(itemId) || orderCurrencyId === parseInt(itemId))) ||
                                (orderType === 'buy' && orderCurrencyId === parseInt(itemId)) ||
                                (orderType === 'sell' && orderItemId === parseInt(itemId))
                            ) {
                                if (foundLines === '') {
                                    foundLines += '```diff\n';
                                }

                                foundLines += `+ [${vendingMachine.location.string}] `;
                                foundLines += `${orderQuantity}x ${orderItemName}`;
                                foundLines += `${orderItemIsBlueprint ? ' (BP)' : ''} for `;
                                foundLines += `${orderCostPerItem}x ${orderCurrencyName}`;
                                foundLines += `${orderCurrencyIsBlueprint ? ' (BP)' : ''} `;
                                foundLines += `(${orderAmountInStock} ${leftString})\n`;

                                if (foundLines.length >= 4000) {
                                    foundLines = prevFoundLines;
                                    foundLines += `...\n`;
                                    full = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundLines === '') {
                        foundLines = client.intlGet(interaction.guildId, 'noItemFound');
                    } else {
                        foundLines += '```';
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `search, ${searchItemName}, ${searchItemId}, ${orderType}`,
                        }),
                        'info',
                    );

                    const embed = DiscordEmbeds.getEmbed({
                        color: Constants.COLOR_DEFAULT,
                        title: client.intlGet(interaction.guildId, 'searchResult', { name: itemName }),
                        description: foundLines,
                        footer: { text: `${instance.serverList[rustplus.serverId].title}` },
                    });

                    await client.interactionEditReply(interaction, { embeds: [embed] });
                    rustplus.log(
                        client.intlGet(interaction.guildId, 'infoCap'),
                        client.intlGet(interaction.guildId, 'searchResult', { name: itemName }),
                        'info',
                    );
                }
                break;

            case 'subscribe':
                {
                    const subscribeItemName = interaction.options.getString('name');
                    const subscribeItemId = interaction.options.getString('id');
                    const orderType = interaction.options.getString('order');

                    let itemId = null;
                    if (subscribeItemName !== null) {
                        const item = client.items.getClosestItemIdByName(subscribeItemName);
                        if (item === null) {
                            const str = client.intlGet(interaction.guildId, 'noItemWithNameFound', {
                                name: subscribeItemName,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                            return;
                        } else {
                            itemId = item;
                        }
                    } else if (subscribeItemId !== null) {
                        if (client.items.itemExist(subscribeItemId)) {
                            itemId = subscribeItemId;
                        } else {
                            const str = client.intlGet(interaction.guildId, 'noItemWithIdFound', {
                                id: subscribeItemId,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                            return;
                        }
                    } else if (subscribeItemName === null && subscribeItemId === null) {
                        const str = client.intlGet(interaction.guildId, 'noNameIdGiven');
                        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                        rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                        return;
                    }
                    const itemName = client.items.getName(itemId);

                    if (instance.marketSubscriptionList[orderType].includes(itemId)) {
                        const str = client.intlGet(interaction.guildId, 'alreadySubscribedToItem', {
                            name: itemName,
                        });
                        await client.interactionEditReply(
                            interaction,
                            DiscordEmbeds.getActionInfoEmbed(1, str, instance.serverList[rustplus.serverId].title),
                        );
                        rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                    } else {
                        instance.marketSubscriptionList[orderType].push(itemId);
                        rustplus.firstPollItems[orderType].push(itemId);
                        await getPersistenceCache().addMarketSubscription(interaction.guildId, orderType, itemId);

                        const str = client.intlGet(interaction.guildId, 'justSubscribedToItem', {
                            name: itemName,
                        });
                        await client.interactionEditReply(
                            interaction,
                            DiscordEmbeds.getActionInfoEmbed(0, str, instance.serverList[rustplus.serverId].title),
                        );
                        rustplus.log(client.intlGet(interaction.guildId, 'infoCap'), str, 'info');
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `subscribe, ${subscribeItemName}, ${subscribeItemId}, ${orderType}`,
                        }),
                        'info',
                    );
                }
                break;

            case 'unsubscribe':
                {
                    const subscribeItemName = interaction.options.getString('name');
                    const subscribeItemId = interaction.options.getString('id');
                    const orderType = interaction.options.getString('order');

                    let itemId = null;
                    if (subscribeItemName !== null) {
                        const item = client.items.getClosestItemIdByName(subscribeItemName);
                        if (item === null) {
                            const str = client.intlGet(interaction.guildId, 'noItemWithNameFound', {
                                name: subscribeItemName,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                            return;
                        } else {
                            itemId = item;
                        }
                    } else if (subscribeItemId !== null) {
                        if (client.items.itemExist(subscribeItemId)) {
                            itemId = subscribeItemId;
                        } else {
                            const str = client.intlGet(interaction.guildId, 'noItemWithIdFound', {
                                id: subscribeItemId,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                            return;
                        }
                    } else if (subscribeItemName === null && subscribeItemId === null) {
                        const str = client.intlGet(interaction.guildId, 'noNameIdGiven');
                        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                        rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                        return;
                    }
                    const itemName = client.items.getName(itemId);

                    if (instance.marketSubscriptionList[orderType].includes(itemId)) {
                        instance.marketSubscriptionList[orderType] = instance.marketSubscriptionList[orderType].filter(
                            (e: string) => e !== itemId,
                        );
                        await getPersistenceCache().removeMarketSubscription(interaction.guildId, orderType, itemId);

                        const str = client.intlGet(interaction.guildId, 'removedSubscribeItem', {
                            name: itemName,
                        });
                        await client.interactionEditReply(
                            interaction,
                            DiscordEmbeds.getActionInfoEmbed(0, str, instance.serverList[rustplus.serverId].title),
                        );
                        rustplus.log(client.intlGet(interaction.guildId, 'infoCap'), str, 'info');
                    } else {
                        const str = client.intlGet(interaction.guildId, 'notExistInSubscription', {
                            name: itemName,
                        });
                        await client.interactionEditReply(
                            interaction,
                            DiscordEmbeds.getActionInfoEmbed(1, str, instance.serverList[rustplus.serverId].title),
                        );
                        rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `subscribe, ${subscribeItemName}, ${subscribeItemId}, ${orderType}`,
                        }),
                        'info',
                    );
                }
                break;

            case 'list':
                {
                    const names = { all: '', buy: '', sell: '' };
                    for (const [orderType, itemIds] of Object.entries(
                        instance.marketSubscriptionList as unknown as Record<string, string[]>,
                    )) {
                        for (const itemId of itemIds) {
                            names[orderType as keyof typeof names] +=
                                `\`${client.items.getName(itemId)} (${itemId})\`\n`;
                        }
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `list`,
                        }),
                        'info',
                    );

                    await client.interactionEditReply(interaction, {
                        embeds: [
                            DiscordEmbeds.getEmbed({
                                color: Constants.COLOR_DEFAULT,
                                title: client.intlGet(interaction.guildId, 'subscriptionList'),
                                footer: { text: instance.serverList[rustplus.serverId].title },
                                fields: [
                                    {
                                        name: client.intlGet(interaction.guildId, 'all'),
                                        value: names['all'] === '' ? '\u200B' : names['all'],
                                        inline: true,
                                    },
                                    {
                                        name: client.intlGet(interaction.guildId, 'buy'),
                                        value: names['buy'] === '' ? '\u200B' : names['buy'],
                                        inline: true,
                                    },
                                    {
                                        name: client.intlGet(interaction.guildId, 'sell'),
                                        value: names['sell'] === '' ? '\u200B' : names['sell'],
                                        inline: true,
                                    },
                                ],
                            }),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });

                    rustplus.log(
                        client.intlGet(interaction.guildId, 'infoCap'),
                        client.intlGet(interaction.guildId, 'showingSubscriptionList'),
                        'info',
                    );
                }
                break;

            case 'blacklist':
                {
                    const choice = interaction.options.getString('choice');
                    const name = interaction.options.getString('name');

                    if (choice === 'add' && name !== null) {
                        if (instance.marketBlacklist.includes(name)) {
                            const str = client.intlGet(interaction.guildId, 'alreadyBlacklisted', {
                                name: name,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                        } else {
                            instance.marketBlacklist.push(name);
                            await getPersistenceCache().addMarketBlacklistItem(interaction.guildId, name);

                            const str = client.intlGet(interaction.guildId, 'justBlacklisted', {
                                name: name,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'infoCap'), str, 'info');
                        }
                    } else if (choice === 'remove' && name !== null) {
                        if (instance.marketBlacklist.includes(name)) {
                            instance.marketBlacklist = instance.marketBlacklist.filter((e: string) => e !== name);
                            await getPersistenceCache().removeMarketBlacklistItem(interaction.guildId, name);

                            const str = client.intlGet(interaction.guildId, 'removedBlacklist', {
                                name: name,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'infoCap'), str, 'info');
                        } else {
                            const str = client.intlGet(interaction.guildId, 'notExistInBlacklist', {
                                name: name,
                            });
                            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                        }
                    } else if (choice === 'show') {
                        let names = '';
                        for (const name of instance.marketBlacklist) {
                            names += `\`${name}\`\n`;
                        }

                        await client.interactionEditReply(interaction, {
                            embeds: [
                                DiscordEmbeds.getEmbed({
                                    color: Constants.COLOR_DEFAULT,
                                    title: client.intlGet(interaction.guildId, 'blacklist'),
                                    footer: { text: instance.serverList[rustplus.serverId].title },
                                    description: names === '' ? '\u200B' : names,
                                }),
                            ],
                            flags: MessageFlags.Ephemeral,
                        });

                        rustplus.log(
                            client.intlGet(interaction.guildId, 'infoCap'),
                            client.intlGet(interaction.guildId, 'showingBlacklist'),
                            'info',
                        );
                    } else if (choice === null || name === null) {
                        const str = client.intlGet(interaction.guildId, 'noNameGiven');
                        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                        rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warn');
                        return;
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `blacklist, ${choice}, ${name}`,
                        }),
                        'info',
                    );
                }
                break;

            default:
                break;
        }
    },
};
