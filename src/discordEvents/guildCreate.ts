import type { Guild } from 'discord.js';
import { getPersistenceCache } from '../persistence/index.js';
import ensureGuildCredentials from '../services/ensureGuildCredentials.js';
import ensureGuildState from '../services/ensureGuildState.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'guildCreate',
    async execute(client: DiscordBot, guild: Guild) {
        await ensureGuildState(client, guild);
        await ensureGuildCredentials(client, guild);
        client.fcmListenersLite[guild.id] = {};

        const instance = await getPersistenceCache().readGuildState(guild.id);
        client.loadGuildIntl(guild.id, instance);

        await client.setupGuild(guild);
    },
};
