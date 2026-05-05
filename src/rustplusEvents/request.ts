export default {
    name: 'request',
    execute(rustplus, client, request) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        /* Not used */
    },
};
