export default {
    name: 'connected',
    async execute(rustplusLite, client) {
        rustplusLite.log(client.intlGet(null, 'connectedCap'), client.intlGet(null, 'connectedToServer'));

        const info = await rustplusLite.getInfoAsync();
        if (!rustplusLite.isResponseValid(info)) {
            rustplusLite.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'somethingWrongWithConnection'),
                'error',
            );
            rustplusLite.disconnect();
            return;
        }
        rustplusLite.log(client.intlGet(null, 'connectedCap'), client.intlGet(null, 'rustplusOperational'));

        rustplusLite._reconnectAttempts = 0;

        if (client.rustplusLiteReconnectTimers[rustplusLite.guildId]) {
            clearTimeout(client.rustplusLiteReconnectTimers[rustplusLite.guildId]);
            client.rustplusLiteReconnectTimers[rustplusLite.guildId] = null;
        }
    },
};
