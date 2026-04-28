import type { Guild } from 'discord.js';
import type { DiscordBot } from '../types/discord.js';
import createInstanceFile from '../util/CreateInstanceFile.js';
import createCredentialsFile from '../util/CreateCredentialsFile.js';

export default {
    name: 'guildCreate',
    async execute(client: DiscordBot, guild: Guild) {
        createInstanceFile(client, guild);
        createCredentialsFile(client, guild);
        client.fcmListenersLite[guild.id] = {};

        (client as any).loadGuildIntl(guild.id);

        await (client as any).setupGuild(guild);
    },
};
