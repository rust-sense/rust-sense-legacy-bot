import config from '../config';

export default {
    name: 'disconnected',
    async execute(rustplusLite, client) {
        rustplusLite.log(client.intlGet(null, 'disconnectedCap'), client.intlGet(null, 'disconnectedFromServer'));

        if (rustplusLite.isActive && client.activeRustplusInstances[rustplusLite.guildId]) {
            rustplusLite.log(client.intlGet(null, 'reconnectingCap'), client.intlGet(null, 'reconnectingToServer'));

            if (client.rustplusLiteReconnectTimers[rustplusLite.guildId]) {
                clearTimeout(client.rustplusLiteReconnectTimers[rustplusLite.guildId]);
                client.rustplusLiteReconnectTimers[rustplusLite.guildId] = null;
            }

            client.rustplusLiteReconnectTimers[rustplusLite.guildId] = setTimeout(
                rustplusLite.rustplus.updateLeaderRustPlusLiteInstance.bind(rustplusLite.rustplus),
                config.general.reconnectIntervalMs,
            );
        }
    },
};
