export default {
    name: 'error',
    execute(rustplusLite, client, error) {
        rustplusLite.log(client.intlGet(null, 'errorCap'), error, 'error');
    },
};
