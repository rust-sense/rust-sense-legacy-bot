module.exports = {
    name: 'error',
    async execute(client, error) {
        client.log(client.intlGet(null, 'errorCap'), error, 'error');
        process.exit(1);
    },
};
