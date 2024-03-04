import { Guild } from 'discord.js';
import DiscordBot from '../DiscordBot';

export default abstract class DiscordEventHandler {
    constructor(public eventName: string) {}

    abstract execute(client: DiscordBot, guild: Guild): Promise<void>;
}
