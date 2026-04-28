import type { Guild } from 'discord.js';
import type DiscordBot from '../structures/DiscordBot.js';
import createInstanceFile from '../util/CreateInstanceFile.js';
import createCredentialsFile from '../util/CreateCredentialsFile.js';

export default {
    name: 'guildCreate',
    async execute(client: DiscordBot, guild: Guild) {
        createInstanceFile(client, guild);
        createCredentialsFile(client, guild);
        client.fcmListenersLite[guild.id] = {};

        const instance = client.getInstance(guild.id);
        client.loadGuildIntl(guild.id, instance);

        await client.setupGuild(guild);
    },
};
