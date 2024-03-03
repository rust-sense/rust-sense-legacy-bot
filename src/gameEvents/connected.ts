import DiscordMessages from '../discordTools/discordMessages.js';

import PollingHandler from '../handlers/pollingHandler.js';
import Info from '../structures/Info.js';
import Map from '../structures/Map.js';

export default {
    name: 'connected',
    async execute(rustplus, client) {
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
        if (!(await rustplus.isResponseValid(map))) {
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
        if (await rustplus.isResponseValid(info)) rustplus.info = new Info(info.info);

        if (client.rustplusMaps.hasOwnProperty(guildId)) {
            if (client.isJpgImageChanged(guildId, map.map)) {
                rustplus.map = new Map(map.map, rustplus);

                await rustplus.map.writeMap(false, true);
                await DiscordMessages.sendServerWipeDetectedMessage(guildId, serverId);
                await DiscordMessages.sendInformationMapMessage(guildId);
            } else {
                rustplus.map = new Map(map.map, rustplus);

                await rustplus.map.writeMap(false, true);
                await DiscordMessages.sendInformationMapMessage(guildId);
            }
        } else {
            rustplus.map = new Map(map.map, rustplus);

            await rustplus.map.writeMap(false, true);
            await DiscordMessages.sendInformationMapMessage(guildId);
        }

        if (client.rustplusReconnecting[guildId]) {
            client.rustplusReconnecting[guildId] = false;

            if (client.rustplusReconnectTimers[guildId]) {
                clearTimeout(client.rustplusReconnectTimers[guildId]);
                client.rustplusReconnectTimers[guildId] = null;
            }

            await DiscordMessages.sendServerChangeStateMessage(guildId, serverId, 0);
        }

        await DiscordMessages.sendServerMessage(guildId, serverId, null);

        /* Setup Smart Devices */
        await require('../discordTools/SetupSwitches')(client, rustplus);
        await require('../discordTools/SetupSwitchGroups')(client, rustplus);
        await require('../discordTools/SetupAlarms')(client, rustplus);
        await require('../discordTools/SetupStorageMonitors')(client, rustplus);
        rustplus.isNewConnection = false;
        rustplus.loadMarkers();

        await PollingHandler.pollingHandler(rustplus, client);
        rustplus.pollingTaskId = setInterval(PollingHandler.pollingHandler, client.pollingIntervalMs, rustplus, client);
        rustplus.isOperational = true;

        rustplus.updateLeaderRustPlusLiteInstance();
    },
};
