export default {
    name: 'connecting',
    execute(rustplusLite, client) {
        rustplusLite.log(client.intlGet(null, 'connectingCap'), client.intlGet(null, 'connectingToServer'));
    },
};
