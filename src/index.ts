import * as Discord from 'discord.js';

import { ensureAppStateDirs } from './utils/filesystemUtils.js';
import DiscordBot from './structures/DiscordBot.js';

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
