import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
const DiscordEmbedsAny = DiscordEmbeds as any;
import type { DiscordBot } from '../types/discord.js';

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

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const stackItemName = interaction.options.getString('name');
        const stackItemId = interaction.options.getString('id');

        const itemId = await (client as any).resolveItemId(interaction, guildId, stackItemName, stackItemId);
        if (itemId === null) return;
        const itemName = (client as any).items.getName(itemId);

        const stackDetails = (client as any).rustlabs.getStackDetailsById(itemId);
        if (stackDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindStackDetails', {
                name: itemName,
            });
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
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

        await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(0, str));
        client.log(client.intlGet(null, 'infoCap'), str, 'info');
    },
};