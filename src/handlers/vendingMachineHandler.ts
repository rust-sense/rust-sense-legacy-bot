import * as DiscordMessages from '../discordTools/discordMessages.js';
import type DiscordBot from '../structures/DiscordBot.js';
import * as GameMapModule from '../util/GameMap.js';

const GameMap = GameMapModule;

export async function handler(rustplus: any, client: DiscordBot, mapMarkers: any) {
    /* Handle Vending Machine changes */
    await checkChanges(rustplus, client, mapMarkers);
}

export async function checkChanges(rustplus: any, client: DiscordBot, mapMarkers: any) {
    const guildId = rustplus.guildId;
    const instance = client.getInstance(guildId);
    const subscriptionList = instance.marketSubscriptionList;
    const vendingMachineType = rustplus.mapMarkers.types.VendingMachine;
    const vendingMachines = rustplus.mapMarkers.getMarkersOfType(vendingMachineType, mapMarkers.markers);

    for (const vendingMachine of vendingMachines) {
        const x = vendingMachine.x;
        const y = vendingMachine.y;
        const vId = `${x}:${y}`;
        const sellOrders = vendingMachine.sellOrders;

        for (const order of sellOrders) {
            const itemId = order.itemId.toString();
            const currencyId = order.currencyId.toString();
            const amountInStock = order.amountInStock;

            for (const orderType of ['all', 'buy', 'sell']) {
                const found = rustplus.foundSubscriptionItems[orderType].find(
                    (e: any) => e.vId === vId && e.itemId === itemId && e.currencyId === currencyId,
                );

                const allCond =
                    orderType === 'all' &&
                    (!(
                        subscriptionList[orderType as keyof typeof subscriptionList].includes(itemId) ||
                        subscriptionList[orderType as keyof typeof subscriptionList].includes(currencyId)
                    ) ||
                        amountInStock === 0);
                const buyCond =
                    orderType === 'buy' &&
                    (!subscriptionList[orderType as keyof typeof subscriptionList].includes(currencyId) ||
                        amountInStock === 0);
                const sellCond =
                    orderType === 'sell' &&
                    (!subscriptionList[orderType as keyof typeof subscriptionList].includes(itemId) ||
                        amountInStock === 0);

                if (allCond || buyCond || sellCond) {
                    rustplus.foundSubscriptionItems[orderType] = rustplus.foundSubscriptionItems[orderType].filter(
                        (e: any) => e.vId !== vId || e.itemId !== itemId || e.currencyId !== currencyId,
                    );
                    continue;
                }

                if (found) continue;

                rustplus.foundSubscriptionItems[orderType].push({
                    vId: vId,
                    itemId: itemId,
                    currencyId: currencyId,
                });

                if (
                    rustplus.isFirstPoll ||
                    rustplus.firstPollItems[orderType].includes(itemId) ||
                    rustplus.firstPollItems[orderType].includes(currencyId)
                ) {
                    continue;
                }

                const location = GameMap.getPos(x, y, rustplus.info.correctedMapSize, rustplus);
                const itemName = client.items.getName(itemId);
                const currencyName = client.items.getName(currencyId);

                const items = [];
                if (subscriptionList[orderType as keyof typeof subscriptionList].includes(itemId)) items.push(itemName);
                if (subscriptionList[orderType as keyof typeof subscriptionList].includes(currencyId))
                    items.push(currencyName);

                const str = client.intlGet(guildId, 'itemAvailableInVendingMachine', {
                    items: items.join(', '),
                    location: location.location,
                });

                await DiscordMessages.sendItemAvailableInVendingMachineMessage(rustplus, str);

                if (rustplus.generalSettings.itemAvailableInVendingMachineNotifyInGame) {
                    rustplus.sendInGameMessage(str);
                }
                rustplus.log(client.intlGet(null, 'infoCap'), str, 'info');
            }
        }
    }

    for (const orderType of ['all', 'buy', 'sell']) {
        for (const foundItem of rustplus.foundSubscriptionItems[orderType]) {
            let stillPresent = false;
            for (const vendingMachine of vendingMachines) {
                const vId = `${vendingMachine.x}:${vendingMachine.y}`;
                if (foundItem.vId === vId) {
                    stillPresent = true;
                    break;
                }
            }

            if (!stillPresent) {
                rustplus.foundSubscriptionItems[orderType] = rustplus.foundSubscriptionItems[orderType].filter(
                    (e: any) => e.vId !== foundItem.vId,
                );
            }
        }
    }

    rustplus.firstPollItems = { all: [], buy: [], sell: [] };
}
