const Discord = require('discord.js');
const DiscordBot = require('./structures/DiscordBot');

import { ensureAppStateDirs } from './service/resourceManager';
import * as mongoStorageService from './service/mongoStorage';
import * as migrationService from './service/migration';

ensureAppStateDirs();

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
    disableEveryone: false,
});

async function start() {
    await mongoStorageService.connect();

    await migrationService.migrate();

    //client.build();
}

process.on('unhandledRejection', (error) => {
    client.log(
        client.intlGet(null, 'errorCap'),
        client.intlGet(null, 'unhandledRejection', {
            error: error,
        }),
        'error',
    );

    console.log(error);
});

start().catch(console.error);
