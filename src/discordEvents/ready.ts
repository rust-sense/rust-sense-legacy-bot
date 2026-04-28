import { ActivityType } from 'discord.js';

import * as BattlemetricsHandler from '../handlers/battlemetricsHandler.js';
import config from '../config.js';
import { cwdPath } from '../utils/filesystemUtils.js';
import createInstanceFile from '../util/CreateInstanceFile.js';
import createCredentialsFile from '../util/CreateCredentialsFile.js';
import type { DiscordBot } from '../types/discord.js';

export default {
    name: 'ready',
    once: true,
    async execute(client: DiscordBot) {
        for (const guild of client.guilds.cache) {
            createInstanceFile(client, guild[1]);
            createCredentialsFile(client, guild[1]);
            client.fcmListenersLite[guild[0]] = {};
        }

        (client as any).loadGuildsIntlFromCache();
        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'loggedInAs', {
                name: (client as any).user.tag,
            }),
            'info',
        );

        try {
            await (client as any).user.setUsername(config.discord.username);
        } catch (e) {
            client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetUsername'), 'warning');
        }

        try {
            await (client as any).user.setAvatar(cwdPath('resources/images/rustplusplus_logo.png'));
        } catch (e) {
            client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetAvatar'), 'warning');
        }

        (client as any).user.setPresence({
            activities: [{ name: '/help', type: ActivityType.Listening }],
            status: 'online',
        });

        client.uptimeBot = new Date();

        for (const guildArray of client.guilds.cache) {
            const guild = guildArray[1];

            try {
                await guild.members.me.setNickname(config.discord.username);
            } catch (e) {
                client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'ignoreSetNickname'), 'warning');
            }
            await (client as any).syncCredentialsWithUsers(guild);
            await (client as any).setupGuild(guild);
        }

        await (client as any).updateBattlemetricsInstances();
        (BattlemetricsHandler as any).handler(client, true);
        (client as any).battlemetricsIntervalId = setInterval((BattlemetricsHandler as any).handler, 60000, client, false);

        (client as any).createRustplusInstancesFromConfig();
    },
};