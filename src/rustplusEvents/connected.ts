import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as PollingHandlerModule from '../handlers/pollingHandler.js';

const PollingHandler = PollingHandlerModule;

export default {
    name: 'connected',
    async execute(rustplus: any, client: any) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        rustplus.log(client.intlGet(null, 'connectedCap'), client.intlGet(null, 'connectedToServer'));

        const instance = client.getInstance(rustplus.guildId);
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;

        rustplus.uptimeServer = new Date();

        /* Start the token replenish task */
        rustplus.tokensReplenishTaskId = setInterval(rustplus.replenishTokens.bind(rustplus), 1000);

        /* Request the map. Act as a check to see if connection is truly operational. */
        const map = await rustplus.getMapAsync(3 * 60 * 1000); /* 3 min timeout */
        if (!rustplus.isResponseValid(map)) {
            rustplus.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'somethingWrongWithConnection'),
                'error',
            );

            instance.activeServer = null;
            client.setInstance(guildId, instance);

            await DiscordMessages.sendServerConnectionInvalidMessage(guildId, serverId);
            await DiscordMessages.sendServerMessage(guildId, serverId, null);

            client.resetRustplusVariables(guildId);

            rustplus.disconnect();
            delete client.rustplusInstances[guildId];
            return;
        }
        rustplus.log(client.intlGet(null, 'connectedCap'), client.intlGet(null, 'rustplusOperational'));

        const info = await rustplus.getInfoAsync();
        if (rustplus.isResponseValid(info) && info.info) {
            const { default: Info } = await import('../structures/Info.js');
            rustplus.info = new Info(info.info);
        }

        const { default: GameMap } = await import('../structures/GameMap.js');
        if (Object.hasOwn(client.rustplusMaps, guildId)) {
            if (client.isJpgImageChanged(guildId, map.map)) {
                rustplus.map = new GameMap(map.map, rustplus);

                await rustplus.map.writeMap(false, true);
                await DiscordMessages.sendServerWipeDetectedMessage(guildId, serverId);
                await DiscordMessages.sendInformationMapMessage(guildId);
            } else {
                rustplus.map = new GameMap(map.map, rustplus);

                await rustplus.map.writeMap(false, true);
                await DiscordMessages.sendInformationMapMessage(guildId);
            }
        } else {
            rustplus.map = new GameMap(map.map, rustplus);

            await rustplus.map.writeMap(false, true);
            await DiscordMessages.sendInformationMapMessage(guildId);
        }

        if (client.rustplusReconnecting[guildId]) {
            client.rustplusReconnecting[guildId] = false;
            rustplus._reconnectAttempts = 0;

            if (client.rustplusReconnectTimers[guildId]) {
                clearTimeout(client.rustplusReconnectTimers[guildId]);
                client.rustplusReconnectTimers[guildId] = null;
            }

            await DiscordMessages.sendServerChangeStateMessage(guildId, serverId, 0);
        }

        await DiscordMessages.sendServerMessage(guildId, serverId, null);

        /* Setup Smart Devices */
        await (await import('../discordTools/SetupSwitches.js')).default(client, rustplus);
        await (await import('../discordTools/SetupSwitchGroups.js')).default(client, rustplus);
        await (await import('../discordTools/SetupAlarms.js')).default(client, rustplus);
        await (await import('../discordTools/SetupStorageMonitors.js')).default(client, rustplus);
        rustplus.isNewConnection = false;
        rustplus.loadMarkers();

        await PollingHandler.pollingHandler(rustplus, client);
        rustplus.restorePersistentRuntimeState();
        rustplus.persistMapMarkersRuntimeState();
        rustplus.pollingTaskId = setInterval(PollingHandler.pollingHandler, client.pollingIntervalMs, rustplus, client);
        rustplus.isOperational = true;

        rustplus.updateLeaderRustPlusLiteInstance();
    },
};
