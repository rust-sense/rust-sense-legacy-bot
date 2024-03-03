import Fs from 'fs';

import Rest from '@discordjs/rest';
import Types from 'discord-api-types/v9';
import Path from 'path';
// @ts-expect-error TS(2307) FIXME: Cannot find module '../../config' or its correspon... Remove this comment to see the full error message
import Config from '../../config';

export default async (client, guild) => {
    const commands = [];
    const commandFiles = Fs.readdirSync(Path.join(__dirname, '..', 'commands')).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`../commands/${file}`);
        // @ts-expect-error TS(2345) FIXME: Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
        commands.push(command.getData(client, guild.id).toJSON());
    }

    const rest = new Rest.REST({ version: '9' }).setToken(Config.discord.token);

    try {
        await rest.put(Types.Routes.applicationGuildCommands(Config.discord.clientId, guild.id), { body: commands });
    } catch (e) {
        client.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'couldNotRegisterSlashCommands', { guildId: guild.id }) +
                client.intlGet(null, 'makeSureApplicationsCommandsEnabled'),
            'error',
        );
        process.exit(1);
    }
    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, 'slashCommandsSuccessRegister', { guildId: guild.id }),
    );
};
