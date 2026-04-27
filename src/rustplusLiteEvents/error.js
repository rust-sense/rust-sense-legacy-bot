export default {
    name: 'error',
    async execute(rustplusLite, client, error) {
        rustplusLite.log(client.intlGet(null, 'errorCap'), error, 'error');
    },
};
