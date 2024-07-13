const Discord = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

import { ensureAppStateDirs } from './service/resourceManager';
const DiscordBot = require('./structures/DiscordBot');

ensureAppStateDirs();

const client = new DiscordBot({
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

client.build();

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

exports.client = client;
