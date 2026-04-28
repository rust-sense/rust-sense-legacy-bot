import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordMessages from '../discordTools/discordMessages.js';
import type { DiscordBot } from '../types/discord.js';

export default {
    name: 'help',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('help')
            .setDescription(client.intlGet(guildId, 'commandsHelpDesc'));
    },

    async execute(client: DiscordBot, interaction: any) {
        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;

        await DiscordMessages.sendHelpMessage(interaction);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(interaction.guildId, 'commandsHelpDesc'), 'info');
    },
};