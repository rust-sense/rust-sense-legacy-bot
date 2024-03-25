import Discord from 'discord.js';

import fs from 'fs';
import path from 'path';
import process from 'process';

import DiscordBot from './structures/DiscordBot';

function ensureAppDir(dirname: string): string {
    const dirnamePath = path.join(process.cwd(), dirname);

    if (!fs.existsSync(dirnamePath)) {
        fs.mkdirSync(dirnamePath);
    }

    return dirnamePath;
}

function setupDiscordClient() {
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

    return client;
}

function createAppDirs() {
    const appDirNames = ['logs', 'instances', 'credentials', 'maps'];
    appDirNames.forEach(ensureAppDir);
}

function setupRejectionHandler() {
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
}

createAppDirs();
setupRejectionHandler();
const client = setupDiscordClient();
export default client;
