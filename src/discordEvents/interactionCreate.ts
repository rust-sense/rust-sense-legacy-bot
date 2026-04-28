import { InteractionType } from 'discord.js';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

function safeDeferUpdate(client: DiscordBot, interaction: any) {
    if (interaction.isButton()) {
        try {
            interaction.deferUpdate();
        } catch (e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'couldNotDeferInteraction'),
                'error',
            );
        }
    }
}

export default {
    name: 'interactionCreate',
    async execute(client: DiscordBot, interaction: any) {
        const instance = client.getInstance(interaction.guildId);

        /* Check so that the interaction comes from valid channels */
        if (!Object.values(instance.channelId).includes(interaction.channelId) && !interaction.isCommand) {
            client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'interactionInvalidChannel'), 'warning');
            safeDeferUpdate(client, interaction);
        }

        if (interaction.isButton()) {
            const ButtonHandler = await import('../handlers/buttonHandler.js');
            await (ButtonHandler as any).default(client, interaction);
        } else if (interaction.isStringSelectMenu()) {
            const SelectMenuHandler = await import('../handlers/selectMenuHandler.js');
            await (SelectMenuHandler as any).default(client, interaction);
        } else if (interaction.type === InteractionType.ApplicationCommand) {
            const command = interaction.client.commands.get(interaction.commandName);

            /* If the command doesn't exist, return */
            if (!command) return;

            try {
                await command.execute(client, interaction);
            } catch (e) {
                client.log(client.intlGet(null, 'errorCap'), e, 'error');

                const str = client.intlGet(interaction.guildId, 'errorExecutingCommand');
                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                client.log(client.intlGet(null, 'errorCap'), str, 'error');
            }
        } else if (interaction.type === InteractionType.ModalSubmit) {
            const ModalHandler = await import('../handlers/modalHandler.js');
            await (ModalHandler as any).default(client, interaction);
        } else {
            client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'unknownInteraction'), 'error');
            safeDeferUpdate(client, interaction);
        }
    },
};