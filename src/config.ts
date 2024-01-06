import 'dotenv/config';

export default {
    general: {
        language: process.env.RPP_LANGUAGE,
        pollingIntervalMs: process.env.RPP_POLLING_INTERVAL,
        showCallStackError: process.env.RPP_LOG_CALL_STACK,
        reconnectIntervalMs: process.env.RPP_RECONNECT_INTERVAL,
    },
    discord: {
        username: process.env.RPP_DISCORD_USERNAME,
        clientId: process.env.RPP_DISCORD_CLIENT_ID,
        token: process.env.RPP_DISCORD_TOKEN,
    },
};
