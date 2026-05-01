export default {
    name: 'connecting',
    async execute(rustplusLite, client) {
        rustplusLite.log(client.intlGet(null, 'connectingCap'), client.intlGet(null, 'connectingToServer'));
    },
};
