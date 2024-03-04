import { ChatInputCommandInteraction, Guild, SlashCommandBuilder, ToAPIApplicationCommandOptions } from 'discord.js';
import DiscordBot from '../DiscordBot';

export type SlashCommandBuilderOnlyToAPI = Pick<SlashCommandBuilder, keyof ToAPIApplicationCommandOptions>;

export default abstract class DiscordCommand {
    constructor(public commandName: string) {}

    abstract builder(client: DiscordBot, guild: Guild): Promise<SlashCommandBuilderOnlyToAPI>;

    abstract execute(client: DiscordBot, interaction: ChatInputCommandInteraction<'raw' | 'cached'>): Promise<unknown>;
}
