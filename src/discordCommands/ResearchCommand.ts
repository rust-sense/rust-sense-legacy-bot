import Builder from '@discordjs/builders';

import { ChatInputCommandInteraction, Guild } from 'discord.js';
import DiscordBot from '../core/DiscordBot.js';
import DiscordCommand from '../core/abstract/DiscordCommand.js';
import DiscordEmbeds from '../discordTools/discordEmbeds.js';
import DiscordMessages from '../discordTools/discordMessages.js';

export default class ResearchCommand extends DiscordCommand {
    constructor() {
        super('research');
    }

    async builder(client: DiscordBot, guild: Guild) {
        const guildId = guild.id;
        return new Builder.SlashCommandBuilder()
            .setName('research')
            .setDescription(client.intlGet(guildId, 'commandsResearchDesc'))
            .addStringOption((option) =>
                option.setName('name').setDescription(client.intlGet(guildId, 'theNameOfTheItem')).setRequired(false),
            )
            .addStringOption((option) =>
                option.setName('id').setDescription(client.intlGet(guildId, 'theIdOfTheItem')).setRequired(false),
            );
    }

    async execute(client: DiscordBot, interaction: ChatInputCommandInteraction) {
        const guildId = interaction.guildId;

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const researchItemName = interaction.options.getString('name');
        const researchItemId = interaction.options.getString('id');

        let itemId = null;
        if (researchItemName !== null) {
            const item = client.items.getClosestItemIdByName(researchItemName);
            if (item === null) {
                const str = client.intlGet(guildId, 'noItemWithNameFound', {
                    name: researchItemName,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            } else {
                itemId = item;
            }
        } else if (researchItemId !== null) {
            if (client.items.itemExist(researchItemId)) {
                itemId = researchItemId;
            } else {
                const str = client.intlGet(guildId, 'noItemWithIdFound', {
                    id: researchItemId,
                });
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                client.log(client.intlGet(guildId, 'warningCap'), str);
                return;
            }
        } else if (researchItemName === null && researchItemId === null) {
            const str = client.intlGet(guildId, 'noNameIdGiven');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }
        const itemName = client.items.getName(itemId);

        const researchDetails = client.rustlabs.getResearchDetailsById(itemId);
        if (researchDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindResearchDetails', {
                name: itemName,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return;
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${researchItemName} ${researchItemId}`,
            }),
        );

        await DiscordMessages.sendResearchMessage(interaction, researchDetails);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsResearchDesc'));
    }
}
