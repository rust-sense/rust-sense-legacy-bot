import Builder from '@discordjs/builders';

import { ChatInputCommandInteraction, Guild } from 'discord.js';
import DiscordBot from '../core/DiscordBot.js';
import DiscordCommand from '../core/abstract/DiscordCommand.js';
import DiscordMessages from '../discordTools/discordMessages.js';

export default class HelpCommand extends DiscordCommand {
    constructor() {
        super('help');
    }

    async builder(client: DiscordBot, guild: Guild) {
        const guildId = guild.id;
        return new Builder.SlashCommandBuilder()
            .setName('help')
            .setDescription(client.intlGet(guildId, 'commandsHelpDesc'));
    }

    async execute(client: DiscordBot, interaction: ChatInputCommandInteraction) {
        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;

        await DiscordMessages.sendHelpMessage(interaction);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(interaction.guildId, 'commandsHelpDesc'));
    }
}
