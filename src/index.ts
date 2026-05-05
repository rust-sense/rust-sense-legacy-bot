import * as Discord from 'discord.js';
import { registerSingleton } from './container.js';
import { closePersistence, initPersistence } from './persistence/index.js';
import DiscordBot from './structures/DiscordBot.js';
import { ensureAppStateDirs } from './utils/filesystemUtils.js';

export const client = new DiscordBot({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildVoiceStates,
    ],
    retryLimit: 2,
    restRequestTimeout: 60000,
} as Discord.ClientOptions);

registerSingleton('discordBot', client);

ensureAppStateDirs().then(async () => {
    await initPersistence();
    client.build();
});

process.on('unhandledRejection', (error) => {
    const errorText = error instanceof Error ? (error.stack ?? error.message) : String(error);
    client.log(
        client.intlGet(null, 'errorCap'),
        client.intlGet(null, 'unhandledRejection', {
            error: errorText,
        }),
        'error',
    );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
    client.log(client.intlGet(null, 'infoCap'), `Received ${signal}, closing persistence`, 'info');
    try {
        await closePersistence();
    } finally {
        process.exit(0);
    }
}

process.once('SIGINT', (signal) => {
    void shutdown(signal);
});

process.once('SIGTERM', (signal) => {
    void shutdown(signal);
});
