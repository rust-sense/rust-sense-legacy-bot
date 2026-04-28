import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

export default {
    name: 'craft',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('craft')
            .setDescription(client.intlGet(guildId, 'commandsCraftDesc'))
            .addStringOption((option) =>
                option.setName('name').setDescription(client.intlGet(guildId, 'theNameOfTheItem')).setRequired(false),
            )
            .addStringOption((option) =>
                option.setName('id').setDescription(client.intlGet(guildId, 'theIdOfTheItem')).setRequired(false),
            )
            .addIntegerOption((option) =>
                option
                    .setName('quantity')
                    .setDescription(client.intlGet(guildId, 'commandsCraftQuantityDesc'))
                    .setRequired(false),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const craftItemName = interaction.options.getString('name');
        const craftItemId = interaction.options.getString('id');
        const craftItemQuantity = interaction.options.getInteger('quantity');

        const itemId = await (client as any).resolveItemId(interaction, guildId, craftItemName, craftItemId);
        if (itemId === null) return;
        const itemName = (client as any).items.getName(itemId);

        const craftDetails = (client as any).rustlabs.getCraftDetailsById(itemId);
        if (craftDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindCraftDetails', {
                name: itemName,
            });
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
            return;
        }

        const quantity = craftItemQuantity === null ? 1 : craftItemQuantity;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${craftItemName} ${craftItemId} ${craftItemQuantity}`,
            }),
            'info',
        );

        await DiscordMessages.sendCraftMessage(interaction, craftDetails, quantity);
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsCraftDesc'), 'info');
    },
};