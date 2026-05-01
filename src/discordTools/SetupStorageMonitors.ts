import type { DiscordBot } from '../types/discord.js';
import * as Constants from '../util/constants.js';
import * as DiscordMessages from './discordMessages.js';
import * as DiscordTools from './discordTools.js';

export default async function setupStorageMonitors(client: DiscordBot, rustplus: any) {
    const instance = client.getInstance(rustplus.guildId);
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;

    if (rustplus.isNewConnection) {
        await DiscordTools.clearTextChannel(guildId, instance.channelId.storageMonitors as string, 100);
    }

    for (const entityId in instance.serverList[serverId].storageMonitors) {
        const entity = instance.serverList[serverId].storageMonitors[entityId];
        const info = await rustplus.getEntityInfoAsync(entityId);

        if (!(await rustplus.isResponseValid(info))) {
            if (entity.reachable === true) {
                await DiscordMessages.sendStorageMonitorNotFoundMessage(guildId, serverId, entityId);
            }
            entity.reachable = false;
        } else {
            entity.reachable = true;
        }
        client.setInstance(guildId, instance);

        if (entity.reachable) {
            rustplus.storageMonitors[entityId] = {
                items: info.entityInfo.payload.items,
                expiry: info.entityInfo.payload.protectionExpiry,
                capacity: info.entityInfo.payload.capacity,
                hasProtection: info.entityInfo.payload.hasProtection,
            };

            if (info.entityInfo.payload.capacity !== 0) {
                if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY) {
                    entity.type = 'toolCupboard';
                    if (info.entityInfo.payload.protectionExpiry === 0) {
                        entity.decaying = true;
                    } else {
                        entity.decaying = false;
                    }
                } else if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_VENDING_MACHINE_CAPACITY) {
                    entity.type = 'vendingMachine';
                } else if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_LARGE_WOOD_BOX_CAPACITY) {
                    entity.type = 'largeWoodBox';
                }
                client.setInstance(guildId, instance);
            }
        }

        await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
    }
}
