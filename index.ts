const Discord = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const DiscordBot = require('./src/structures/DiscordBot');

const APP_DIR_NAMES = ['logs', 'instances', 'credentials', 'maps'];

APP_DIR_NAMES.forEach(ensureAppDir);

function ensureAppDir(dirName: string) {
    const fullPath = path.join(__dirname, dirName);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath);
    }
}

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
