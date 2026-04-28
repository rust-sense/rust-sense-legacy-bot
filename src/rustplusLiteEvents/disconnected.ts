import config from '../config.js';

export default {
    name: 'disconnected',
    async execute(rustplusLite, client) {
        rustplusLite.log(client.intlGet(null, 'disconnectedCap'), client.intlGet(null, 'disconnectedFromServer'));

        if (rustplusLite.isActive && client.activeRustplusInstances[rustplusLite.guildId]) {
            const attempt = ++rustplusLite._reconnectAttempts;
            const delay = Math.min(
                config.general.reconnectIntervalMs * Math.pow(2, attempt - 1),
                120000,
            );

            rustplusLite.log(
                client.intlGet(null, 'reconnectingCap'),
                `${client.intlGet(null, 'reconnectingToServer')} (attempt ${attempt}, delay ${delay / 1000}s)`,
            );

            if (client.rustplusLiteReconnectTimers[rustplusLite.guildId]) {
                clearTimeout(client.rustplusLiteReconnectTimers[rustplusLite.guildId]);
                client.rustplusLiteReconnectTimers[rustplusLite.guildId] = null;
            }

            client.rustplusLiteReconnectTimers[rustplusLite.guildId] = setTimeout(
                rustplusLite.rustplus.updateLeaderRustPlusLiteInstance.bind(rustplusLite.rustplus),
                delay,
            );
        }
    },
};
