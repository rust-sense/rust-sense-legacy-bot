import type { Guild } from 'discord.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'guildDelete',
    async execute(client: DiscordBot, guild: Guild) {
        client.deleteGuildState(guild.id);
    },
};
