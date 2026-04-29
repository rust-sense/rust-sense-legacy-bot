export default {
    general: {
        language: process.env.RPP_LANGUAGE || 'en',
        pollingIntervalMs: Number(process.env.RPP_POLLING_INTERVAL) || 10000,
        showCallStackError: process.env.RPP_LOG_CALL_STACK || false,
        reconnectIntervalMs: Number(process.env.RPP_RECONNECT_INTERVAL) || 15000,
        logFileDir: process.env.RPP_LOG_FILE_DIR || null,
    },
    discord: {
        username: process.env.RPP_DISCORD_USERNAME || 'rustplusplus',
        clientId: process.env.RPP_DISCORD_CLIENT_ID || '',
        token: process.env.RPP_DISCORD_TOKEN || '',
        ownerUserId: process.env.RPP_DISCORD_OWNER_USER_ID || null,
    },
};
