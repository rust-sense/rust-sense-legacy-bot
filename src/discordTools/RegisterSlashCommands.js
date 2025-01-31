const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

import config from '../config';
import discordCommands from '../discordCommands';

module.exports = async (client, guild) => {
    const commands = discordCommands.map((command) => command.getData(client, guild.id).toJSON());

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
    );
};
