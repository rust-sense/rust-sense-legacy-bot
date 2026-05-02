import type { Guild } from 'discord.js';
import { getPersistenceCache } from '../persistence/index.js';
import type DiscordBot from '../structures/DiscordBot.js';
import createCredentialsFile from '../util/CreateCredentialsFile.js';
import createInstanceFile from '../util/CreateInstanceFile.js';

export default {
    name: 'guildCreate',
    async execute(client: DiscordBot, guild: Guild) {
        await createInstanceFile(client, guild);
        await createCredentialsFile(client, guild);
        client.fcmListenersLite[guild.id] = {};

        const instance = await getPersistenceCache().readGuildState(guild.id);
        client.loadGuildIntl(guild.id, instance);

        await client.setupGuild(guild);
    },
};
