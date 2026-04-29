import type { Guild } from 'discord.js';
import { REST, Routes } from 'discord.js';

import config from '../config.js';
import discordCommands from '../discordCommands/index.js';
import type { DiscordBot } from '../types/discord.js';

export default async function registerSlashCommands(client: DiscordBot, guild: Guild) {
    const commands = discordCommands.map((command: any) => command.getData(client, guild.id).toJSON());

    const rest = new REST().setToken(config.discord.token);

    try {
        await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guild.id), { body: commands });
    } catch (e) {
        client.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'couldNotRegisterSlashCommands', {
                guildId: guild.id,
            }) + client.intlGet(null, 'makeSureApplicationsCommandsEnabled'),
            'error',
        );
        process.exit(1);
    }

    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, 'slashCommandsSuccessRegister', {
            guildId: guild.id,
        }),
        'info',
    );
}
