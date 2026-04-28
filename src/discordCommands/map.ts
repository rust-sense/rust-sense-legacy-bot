import { SlashCommandBuilder } from '@discordjs/builders';
import { AttachmentBuilder } from 'discord.js';

import * as Constants from '../util/constants.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import { cwdPath } from '../utils/filesystemUtils.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

export default {
    name: 'map',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('map')
            .setDescription(client.intlGet(guildId, 'commandsMapDesc'))
            .addSubcommand((subcommand) =>
                subcommand.setName('all').setDescription(client.intlGet(guildId, 'commandsMapAllDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('clean').setDescription(client.intlGet(guildId, 'commandsMapCleanDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('monuments').setDescription(client.intlGet(guildId, 'commandsMapMonumentsDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('markers').setDescription(client.intlGet(guildId, 'commandsMapMarkersDesc')),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const instance = client.getInstance(interaction.guildId);
        const rustplus = (client as any).rustplusInstances[interaction.guildId];

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        if (!rustplus || (rustplus && !rustplus.isOperational)) {
            const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warning');
            return;
        }

        switch (interaction.options.getSubcommand()) {
            case 'all':
                {
                    await rustplus.map.writeMap(true, true);
                }
                break;

            case 'clean':
                {
                    /* Do nothing */
                }
                break;

            case 'monuments':
                {
                    await rustplus.map.writeMap(false, true);
                }
                break;

            case 'markers':
                {
                    await rustplus.map.writeMap(true, false);
                }
                break;

            default:
                {
                }
                break;
        }

        let file = null;
        if (interaction.options.getSubcommand() === 'clean') {
            file = new AttachmentBuilder(cwdPath(`maps/${interaction.guildId}_map_clean.png`));
        } else {
            file = new AttachmentBuilder(cwdPath(`maps/${interaction.guildId}_map_full.png`));
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${interaction.options.getSubcommand()}`,
            }),
            'info',
        );

        const fileName = interaction.options.getSubcommand() === 'clean' ? 'clean' : 'full';
        await (client as any).interactionEditReply(interaction, {
            embeds: [
                DiscordEmbedsAny.getEmbed({
                    color: Constants.COLOR_DEFAULT,
                    image: `attachment://${interaction.guildId}_map_${fileName}.png`,
                    footer: {
                        text: instance.serverList[rustplus.serverId].title,
                    },
                }),
            ],
            files: [file],
            ephemeral: true,
        });
        rustplus.log(
            client.intlGet(interaction.guildId, 'infoCap'),
            client.intlGet(interaction.guildId, 'displayingMap', {
                mapName: fileName,
            }),
            'info',
        );
    },
};