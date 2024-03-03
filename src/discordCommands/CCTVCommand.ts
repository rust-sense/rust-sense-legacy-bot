import Builder from '@discordjs/builders';

import { ChatInputCommandInteraction, Guild } from 'discord.js';
import DiscordBot from '../core/DiscordBot.js';
import DiscordCommand from '../core/abstract/DiscordCommand.js';
import DiscordMessages from '../discordTools/discordMessages.js';

export default class CCTVCommand extends DiscordCommand {
    constructor() {
        super('cctv');
    }

    async builder(client: DiscordBot, guild: Guild) {
        const guildId = guild.id;
        return new Builder.SlashCommandBuilder()
            .setName('cctv')
            .setDescription(client.intlGet(guildId, 'commandsCctvDesc'))
            .addStringOption((option) =>
                option
                    .setName('monument')
                    .setDescription(client.intlGet(guildId, 'rustMonument'))
                    .setRequired(true)
                    .addChoices(
                        { name: client.intlGet(guildId, 'abandonedMilitaryBase'), value: 'Abandoned Military Base' },
                        { name: client.intlGet(guildId, 'banditCamp'), value: 'Bandit Camp' },
                        { name: client.intlGet(guildId, 'theDome'), value: 'Dome' },
                        { name: client.intlGet(guildId, 'largeOilRig'), value: 'Large Oil Rig' },
                        { name: client.intlGet(guildId, 'missileSilo'), value: 'Missile Silo' },
                        { name: client.intlGet(guildId, 'outpost'), value: 'Outpost' },
                        { name: client.intlGet(guildId, 'smallOilRig'), value: 'Small Oil Rig' },
                        { name: client.intlGet(guildId, 'underwaterLab'), value: 'Underwater Labs' },
                    ),
            );
    }

    async execute(client: DiscordBot, interaction: ChatInputCommandInteraction) {
        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;

        const monument = interaction.options.getString('monument');
        const cctvCodes = client.cctv.getCodes(monument);
        const dynamic = client.cctv.isDynamic(monument);

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${monument}`,
            }),
        );

        await DiscordMessages.sendCctvMessage(interaction, monument, cctvCodes, dynamic);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(interaction.guildId, 'commandsCctvDesc'));
    }
}
