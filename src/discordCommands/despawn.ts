import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
const DiscordEmbedsAny = DiscordEmbeds as any;
import type { DiscordBot } from '../types/discord.js';

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

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const despawnItemName = interaction.options.getString('name');
        const despawnItemId = interaction.options.getString('id');

        const itemId = await (client as any).resolveItemId(interaction, guildId, despawnItemName, despawnItemId);
        if (itemId === null) return;
        const itemName = (client as any).items.getName(itemId);

        const despawnDetails = (client as any).rustlabs.getDespawnDetailsById(itemId);
        if (despawnDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindDespawnDetails', {
                name: itemName,
            });
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
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

        await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(0, str));
        client.log(client.intlGet(null, 'infoCap'), str, 'info');
    },
};