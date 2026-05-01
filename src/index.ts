import * as Discord from 'discord.js';
import { registerSingleton } from './container.js';
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

ensureAppStateDirs().then(() => {
    client.build();
});

process.on('unhandledRejection', (error) => {
    client.log(
        client.intlGet(null, 'errorCap'),
        client.intlGet(null, 'unhandledRejection', {
            error: error,
        }),
        'error',
    );

    console.error(error);
});
