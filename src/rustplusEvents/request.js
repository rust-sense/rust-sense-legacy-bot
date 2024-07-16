module.exports = {
    name: 'request',
    async execute(rustplus, client, request) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        /* Not used */
    },
};
