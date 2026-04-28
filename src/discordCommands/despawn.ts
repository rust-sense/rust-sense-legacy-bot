import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'despawn',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('despawn')
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
        await interaction.deferReply({ ephemeral: true });

        const despawnItemName = interaction.options.getString('name');
        const despawnItemId = interaction.options.getString('id');

        const itemId = await client.resolveItemId(interaction, guildId, despawnItemName, despawnItemId);
        if (itemId === null) return;
        const itemName = client.items.getName(itemId);

        const despawnDetails = client.rustlabs.getDespawnDetailsById(itemId);
        if (despawnDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindDespawnDetails', {
                name: itemName,
            });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warn');
            return;
        }

        const despawnTime = despawnDetails[2].timeString;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${despawnItemName} ${despawnItemId}`,
            }),
            'info',
        );

        const str = client.intlGet(guildId, 'despawnTimeOfItem', {
            item: itemName,
            time: despawnTime,
        });

        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
        client.log(client.intlGet(null, 'infoCap'), str, 'info');
    },
};