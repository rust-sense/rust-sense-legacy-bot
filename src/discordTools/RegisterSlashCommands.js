const fs = require('node:fs');
const path = require('node:path');
const Rest = require('@discordjs/rest');
const Types = require('discord-api-types/v9');

import config from '../config';
import discordCommands from '../discordCommands';

module.exports = async (client, guild) => {
    const commands = discordCommands.map((command) => command.getData(client, guild.id).toJSON());

    const rest = new Rest.REST({ version: '9' }).setToken(config.discord.token);

    try {
        await rest.put(Types.Routes.applicationGuildCommands(config.discord.clientId, guild.id), { body: commands });
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
