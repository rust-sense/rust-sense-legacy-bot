import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordMessages from '../discordTools/discordMessages.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'help',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder().setName('help').setDescription(client.intlGet(guildId, 'commandsHelpDesc'));
    },

    async execute(client: DiscordBot, interaction: any) {
        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;

        await DiscordMessages.sendHelpMessage(interaction);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(interaction.guildId, 'commandsHelpDesc'), 'info');
    },
};
