const Discord = require('discord.js');
const Path = require('node:path');

const BattlemetricsHandler = require('../handlers/battlemetricsHandler');
import config from '../config.js';
import { cwdPath } from '../utils/filesystemUtils.js';

export default {
    name: 'ready',
    once: true,
    async execute(client) {
        for (const guild of client.guilds.cache) {
            require('../util/CreateInstanceFile')(client, guild[1]);
            require('../util/CreateCredentialsFile')(client, guild[1]);
            client.fcmListenersLite[guild[0]] = new Object();
        }

        client.loadGuildsIntlFromCache();
        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'loggedInAs', {
                name: client.user.tag,
            }),
        );

        try {
            await client.user.setUsername(config.discord.username);
        } catch (e) {
            client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetUsername'));
        }

        try {
            await client.user.setAvatar(cwdPath('resources/images/rustplusplus_logo.png'));
        } catch (e) {
            client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetAvatar'));
        }

        client.user.setPresence({
            activities: [{ name: '/help', type: Discord.ActivityType.Listening }],
            status: 'online',
        });

        client.uptimeBot = new Date();

        for (const guildArray of client.guilds.cache) {
            const guild = guildArray[1];

            try {
                await guild.members.me.setNickname(config.discord.username);
            } catch (e) {
                client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetNickname'));
            }
            await client.syncCredentialsWithUsers(guild);
            await client.setupGuild(guild);
        }

        await client.updateBattlemetricsInstances();
        BattlemetricsHandler.handler(client, true);
        client.battlemetricsIntervalId = setInterval(BattlemetricsHandler.handler, 60000, client, false);

        client.createRustplusInstancesFromConfig();
    },
};
