import { SlashCommandBuilder } from '@discordjs/builders';

import * as Constants from '../util/constants.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;
const Scrape = await import('../util/scrape.js') as any;

export default {
    name: 'whitelist',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('whitelist')
            .setDescription(client.intlGet(guildId, 'commandsWhitelistDesc'))
            .addSubcommand(subcommand => subcommand
                .setName('add')
                .setDescription(client.intlGet(guildId, 'commandsWhitelistAddDesc'))
                .addStringOption(option => option
                    .setName('steamid')
                    .setDescription(client.intlGet(guildId, 'commandsWhitelistSteamidDesc'))
                    .setRequired(true)))
            .addSubcommand(subcommand => subcommand
                .setName('remove')
                .setDescription(client.intlGet(guildId, 'commandsWhitelistRemoveDesc'))
                .addStringOption(option => option
                    .setName('steamid')
                    .setDescription(client.intlGet(guildId, 'commandsWhitelistSteamidDesc'))
                    .setRequired(true)))
            .addSubcommand(subcommand => subcommand
                .setName('show')
                .setDescription(client.intlGet(guildId, 'commandsWhitelistShowDesc')));
    },

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!await (client as any).validatePermissions(interaction)) return;

        if (!(client as any).isAdministrator(interaction)) {
            const str = client.intlGet(guildId, 'missingPermission');
            await (client as any).interactionReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warning');
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        ensureWhitelist(instance);

        switch (interaction.options.getSubcommand()) {
            case 'add': {
                const steamid = interaction.options.getString('steamid').trim();
                const steamName = await getSteamName(client, steamid);

                let successful = 0;
                let str = '';
                if (instance.whitelist['steamIds'].includes(steamid)) {
                    str = client.intlGet(guildId, 'userAlreadyInWhitelist', { user: steamName });
                    successful = 1;
                }
                else {
                    instance.whitelist['steamIds'].push(steamid);
                    client.setInstance(guildId, instance);
                    str = client.intlGet(guildId, 'userAddedToWhitelist', { user: steamName });
                }

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
                    id: `${verifyId}`,
                    value: `add, ${steamid}`
                }), 'info');

                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(successful, str));
                client.log(client.intlGet(null, 'infoCap'), str, 'info');
                return;
            } break;

            case 'remove': {
                const steamid = interaction.options.getString('steamid').trim();
                const steamName = await getSteamName(client, steamid);

                let successful = 0;
                let str = '';
                if (!instance.whitelist['steamIds'].includes(steamid)) {
                    str = client.intlGet(guildId, 'userNotInWhitelist', { user: steamName });
                    successful = 1;
                }
                else {
                    instance.whitelist['steamIds'] =
                        instance.whitelist['steamIds'].filter((e: string) => e !== steamid);
                    client.setInstance(guildId, instance);
                    str = client.intlGet(guildId, 'userRemovedFromWhitelist', { user: steamName });
                }

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
                    id: `${verifyId}`,
                    value: `remove, ${steamid}`
                }), 'info');

                await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(successful, str));
                client.log(client.intlGet(null, 'infoCap'), str, 'info');
                return;
            } break;

            case 'show': {
                let steamIds = '';
                for (const steamId of instance.whitelist['steamIds']) {
                    const steamName = await getSteamName(client, steamId);
                    steamIds += `${steamName}\n`;
                }

                await (client as any).interactionEditReply(interaction, {
                    embeds: [DiscordEmbedsAny.getEmbed({
                        color: Constants.COLOR_DEFAULT,
                        title: client.intlGet(guildId, 'whitelist'),
                        fields: [
                            {
                                name: 'SteamId',
                                value: steamIds === '' ? '\u200B' : steamIds,
                                inline: true
                            }]
                    })],
                    ephemeral: true
                });

                client.log(client.intlGet(guildId, 'infoCap'), client.intlGet(guildId, 'showingWhitelist'), 'info');
                return;
            } break;

            default: {
            } break;
        }
    },
};

function ensureWhitelist(instance: any) {
    if (!instance.hasOwnProperty('whitelist')) instance.whitelist = {};
    if (!instance.whitelist.hasOwnProperty('steamIds')) instance.whitelist['steamIds'] = [];
}

async function getSteamName(client: DiscordBot, steamid: string) {
    const steamName = await Scrape.default.scrapeSteamProfileName(client, steamid);
    if (steamName) return `${steamName} (${steamid})`;
    return `${steamid}`;
}