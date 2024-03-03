import Discord from 'discord.js';

import Path from 'path';
import BattlemetricsHandler from '../handlers/battlemetricsHandler.js';
// @ts-expect-error TS(2307) FIXME: Cannot find module '../../config' or its correspon... Remove this comment to see the full error message
import Config from '../../config';
import DiscordBot from '../core/DiscordBot.js';

export default {
    name: 'ready',
    once: true,
    async execute(client: DiscordBot) {
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
            await client.user.setUsername(Config.discord.username);
        } catch (e) {
            client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetUsername'));
        }

        try {
            await client.user.setAvatar(Path.join(__dirname, '..', 'resources/images/rustplusplus_logo.png'));
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
                await guild.members.me.setNickname(Config.discord.username);
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
