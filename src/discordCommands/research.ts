import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'research',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('research')
            .setDescription(client.intlGet(guildId, 'commandsResearchDesc'))
            .addStringOption((option) =>
                option.setName('name').setDescription(client.intlGet(guildId, 'theNameOfTheItem')).setRequired(false),
            )
            .addStringOption((option) =>
                option.setName('id').setDescription(client.intlGet(guildId, 'theIdOfTheItem')).setRequired(false),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;

        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const researchItemName = interaction.options.getString('name');
        const researchItemId = interaction.options.getString('id');

        const itemId = await client.resolveItemId(interaction, guildId, researchItemName, researchItemId);
        if (itemId === null) return;
        const itemName = client.items.getName(itemId);

        const researchDetails = client.rustlabs.getResearchDetailsById(itemId);
        if (researchDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindResearchDetails', {
                name: itemName,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warn');
            return;
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${researchItemName} ${researchItemId}`,
            }),
            'info',
        );

        await DiscordMessages.sendResearchMessage(interaction, researchDetails);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsResearchDesc'), 'info');
    },
};
