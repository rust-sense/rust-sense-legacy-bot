import { InteractionType } from 'discord.js';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import type DiscordBot from '../structures/DiscordBot.js';

function safeDeferUpdate(client: DiscordBot, interaction: any) {
    if (interaction.isButton()) {
        try {
            interaction.deferUpdate();
        } catch (e) {
            client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'couldNotDeferInteraction'), 'error');
        }
    }
}

export default {
    name: 'interactionCreate',
    async execute(client: DiscordBot, interaction: any) {
        const instance = client.getInstance(interaction.guildId);

        /* Check so that the interaction comes from valid channels */
        if (!Object.values(instance.channelId).includes(interaction.channelId) && !interaction.isCommand) {
            client.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'interactionInvalidChannel'), 'warn');
            safeDeferUpdate(client, interaction);
        }

        if (interaction.isButton()) {
            const ButtonHandler = (await import('../handlers/buttonHandler.js')) as {
                default: (client: DiscordBot, interaction: any) => Promise<void>;
            };
            await ButtonHandler.default(client, interaction);
        } else if (interaction.isStringSelectMenu()) {
            const SelectMenuHandler = (await import('../handlers/selectMenuHandler.js')) as {
                default: (client: DiscordBot, interaction: any) => Promise<void>;
            };
            await SelectMenuHandler.default(client, interaction);
        } else if (interaction.type === InteractionType.ApplicationCommand) {
            const command = interaction.client.commands.get(interaction.commandName);

            /* If the command doesn't exist, return */
            if (!command) return;

            try {
                await command.execute(client, interaction);
            } catch (e) {
                client.log(client.intlGet(null, 'errorCap'), e, 'error');

                const str = client.intlGet(interaction.guildId, 'errorExecutingCommand');
                const embed = DiscordEmbeds.getActionInfoEmbed(1, str);
                try {
                    await interaction.editReply(embed);
                } catch {
                    try {
                        await interaction.reply(embed);
                    } catch {
                        /* interaction is dead — nothing to do */
                    }
                }
                client.log(client.intlGet(null, 'errorCap'), str, 'error');
            }
        } else if (interaction.type === InteractionType.ModalSubmit) {
            const ModalHandler = await import('../handlers/modalHandler.js');
            await ModalHandler.default(client, interaction);
        } else {
            client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'unknownInteraction'), 'error');
            safeDeferUpdate(client, interaction);
        }
    },
};
