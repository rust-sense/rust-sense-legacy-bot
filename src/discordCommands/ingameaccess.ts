import { SlashCommandBuilder } from '@discordjs/builders';

import * as Constants from '../util/constants.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'ingameaccess',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('ingameaccess')
            .setDescription(client.intlGet(guildId, 'commandsInGameAccessDesc'))
            .addSubcommand(subcommand => subcommand
                .setName('mode')
                .setDescription(client.intlGet(guildId, 'commandsInGameAccessModeDesc'))
                .addStringOption(option => option
                    .setName('mode')
                    .setDescription(client.intlGet(guildId, 'commandsInGameAccessModeOptionDesc'))
                    .setRequired(true)
                    .addChoices(
                        { name: client.intlGet(guildId, 'blacklist'), value: 'blacklist' },
                        { name: client.intlGet(guildId, 'whitelist'), value: 'whitelist' })))
            .addSubcommand(subcommand => subcommand
                .setName('show')
                .setDescription(client.intlGet(guildId, 'commandsInGameAccessShowDesc')));
    },

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);
        const rustplus = client.rustplusInstances[guildId];

        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;

        if (!client.isAdministrator(interaction)) {
            const str = client.intlGet(guildId, 'missingPermission');
            await client.interactionReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warn');
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        ensureGeneralSettings(instance);

        switch (interaction.options.getSubcommand()) {
            case 'mode': {
                const mode = normalizeAccessMode(interaction.options.getString('mode'));
                instance.generalSettings.inGameCommandAccessMode = mode;
                client.setInstance(guildId, instance);

                if (rustplus) rustplus.generalSettings.inGameCommandAccessMode = mode;

                const str = client.intlGet(guildId, 'inGameCommandAccessModeSet', {
                    mode: client.intlGet(guildId, mode)
                });

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
                    id: `${verifyId}`,
                    value: `mode, ${mode}`
                }), 'info');

                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
                client.log(client.intlGet(null, 'infoCap'), str, 'info');
                return;
            } break;

            case 'show': {
                const mode = normalizeAccessMode(instance.generalSettings.inGameCommandAccessMode as string);
                const blacklistCount = getListCount(instance, 'blacklist');
                const whitelistCount = getListCount(instance, 'whitelist');

                await client.interactionEditReply(interaction, {
                    embeds: [DiscordEmbeds.getEmbed({
                        color: Constants.COLOR_DEFAULT,
                        title: client.intlGet(guildId, 'inGameCommandAccess'),
                        description: client.intlGet(guildId,
                            mode === 'whitelist' ?
                                'inGameCommandAccessModeWhitelistInfo' :
                                'inGameCommandAccessModeBlacklistInfo'),
                        fields: [
                            {
                                name: client.intlGet(guildId, 'mode'),
                                value: client.intlGet(guildId, mode),
                                inline: true
                            },
                            {
                                name: client.intlGet(guildId, 'blacklist'),
                                value: `${blacklistCount}`,
                                inline: true
                            },
                            {
                                name: client.intlGet(guildId, 'whitelist'),
                                value: `${whitelistCount}`,
                                inline: true
                            }]
                    })],
                    ephemeral: true
                });

                client.log(client.intlGet(null, 'infoCap'),
                    client.intlGet(guildId, 'showingInGameCommandAccess'), 'info');
                return;
            } break;

            default: {
            } break;
        }
    },
};

function ensureGeneralSettings(instance: any) {
    if (!instance.hasOwnProperty('generalSettings')) instance.generalSettings = {};
    instance.generalSettings.inGameCommandAccessMode =
        normalizeAccessMode(instance.generalSettings.inGameCommandAccessMode);
}

function normalizeAccessMode(mode: string | null) {
    return `${mode || 'blacklist'}`.toLowerCase() === 'whitelist' ? 'whitelist' : 'blacklist';
}

function getListCount(instance: any, listType: string) {
    if (!instance.hasOwnProperty(listType)) return 0;
    if (!instance[listType].hasOwnProperty('steamIds')) return 0;
    if (!Array.isArray(instance[listType]['steamIds'])) return 0;
    return instance[listType]['steamIds'].length;
}