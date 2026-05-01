import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'stack',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('stack')
            .setDescription(client.intlGet(guildId, 'commandsStackDesc'))
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

        const stackItemName = interaction.options.getString('name');
        const stackItemId = interaction.options.getString('id');

        const itemId = await client.resolveItemId(interaction, guildId, stackItemName, stackItemId);
        if (itemId === null) return;
        const itemName = client.items.getName(itemId);

        const stackDetails = client.rustlabs.getStackDetailsById(itemId);
        if (stackDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindStackDetails', {
                name: itemName,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warn');
            return;
        }

        const quantity = stackDetails[2].quantity;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${stackItemName} ${stackItemId}`,
            }),
            'info',
        );

        const str = client.intlGet(guildId, 'stackSizeOfItem', {
            item: itemName,
            quantity: quantity,
        });

        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
        client.log(client.intlGet(null, 'infoCap'), str, 'info');
    },
};
