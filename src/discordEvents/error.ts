export default {
    name: 'error',
    execute(client, error) {
        client.log(client.intlGet(null, 'errorCap'), error, 'error');
        process.exit(1);
    },
};
