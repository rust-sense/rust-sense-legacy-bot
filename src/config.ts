type ConfigType = {
    general: {
        language: string;
        pollingIntervalMs: number;
        showCallStackError: boolean;
        reconnectIntervalMs: number;
    };
    discord: {
        username: string;
        clientId: string;
        token: string;
        ownerUserId: string | null;
    };
    mongo: {
        connectionString: string | null;
    };
};

export default {
    general: {
        language: process.env.RPP_LANGUAGE || 'en',
        pollingIntervalMs: process.env.RPP_POLLING_INTERVAL || 10000,
        showCallStackError: process.env.RPP_LOG_CALL_STACK || false,
        reconnectIntervalMs: process.env.RPP_RECONNECT_INTERVAL || 15000,
    },
    discord: {
        username: process.env.RPP_DISCORD_USERNAME || 'rustplusplus',
        clientId: process.env.RPP_DISCORD_CLIENT_ID || '',
        token: process.env.RPP_DISCORD_TOKEN || '',
        ownerUserId: process.env.RPP_DISCORD_OWNER_USER_ID || null,
    },
    mongo: {
        connectionString: process.env.RPP_MONGO_CONNECTION_STRING || null,
    },
} as ConfigType;
