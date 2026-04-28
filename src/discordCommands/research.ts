import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

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

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const researchItemName = interaction.options.getString('name');
        const researchItemId = interaction.options.getString('id');

        const itemId = await (client as any).resolveItemId(interaction, guildId, researchItemName, researchItemId);
        if (itemId === null) return;
        const itemName = (client as any).items.getName(itemId);

        const researchDetails = (client as any).rustlabs.getResearchDetailsById(itemId);
        if (researchDetails === null) {
            const str = client.intlGet(guildId, 'couldNotFindResearchDetails', {
                name: itemName,
            });
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str, 'warning');
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