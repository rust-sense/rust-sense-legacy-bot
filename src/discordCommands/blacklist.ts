import { SlashCommandBuilder } from '@discordjs/builders';

import * as Constants from '../util/constants.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as PermissionHandler from '../handlers/permissionHandler.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;
const Scrape = await import('../util/scrape.js') as any;

export default {
    name: 'blacklist',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('blacklist')
            .setDescription(client.intlGet(guildId, 'commandsBlacklistDesc'))
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('add')
                    .setDescription(client.intlGet(guildId, 'commandsBlacklistAddDesc'))
                    .addUserOption((option) =>
                        option
                            .setName('discord_user')
                            .setDescription(client.intlGet(guildId, 'commandsBlacklistDiscordUserDesc'))
                            .setRequired(false),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('steamid')
                            .setDescription(client.intlGet(guildId, 'commandsBlacklistSteamidDesc'))
                            .setRequired(false),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('remove')
                    .setDescription(client.intlGet(guildId, 'commandsBlacklistRemoveDesc'))
                    .addUserOption((option) =>
                        option
                            .setName('discord_user')
                            .setDescription(client.intlGet(guildId, 'commandsBlacklistDiscordUserDesc'))
                            .setRequired(false),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('steamid')
                            .setDescription(client.intlGet(guildId, 'commandsBlacklistSteamidDesc'))
                            .setRequired(false),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('show').setDescription(client.intlGet(guildId, 'commandsBlacklistShowDesc')),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;

        if (!(client as any).isAdministrator(interaction)) {
            const str = client.intlGet(guildId, 'missingPermission');
            await (client as any).interactionReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warning');
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const guild = DiscordTools.getGuild(guildId);

        switch (interaction.options.getSubcommand()) {
            case 'add':
                {
                    const discordUser = interaction.options.getUser('discord_user');
                    const steamid = interaction.options.getString('steamid');

                    if (discordUser === null && steamid === null) {
                        const str = client.intlGet(guildId, 'missingArguments');
                        await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                        client.log(client.intlGet(null, 'warningCap'), str, 'warning');
                        return;
                    }

                    let successful = 0;

                    let str = '';
                    if (discordUser !== null) {
                        if (instance.blacklist['discordIds'].includes(discordUser.id)) {
                            str +=
                                client.intlGet(guildId, 'userAlreadyInBlacklist', {
                                    user: `${discordUser.username} (${discordUser.id})`,
                                }) + ' ';
                            successful = 1;
                        } else {
                            instance.blacklist['discordIds'].push(discordUser.id);
                            client.setInstance(guildId, instance);

                            await PermissionHandler.resetPermissionsAllChannels(client, guild!);

                            str +=
                                client.intlGet(guildId, 'userAddedToBlacklist', {
                                    user: `${discordUser.username} (${discordUser.id})`,
                                }) + ' ';
                        }
                    }

                    if (steamid !== null) {
                        let name = '';
                        const steamName = await Scrape.default.scrapeSteamProfileName(client, steamid);
                        if (steamName) name += `${steamName} (${steamid})`;
                        else name += `${steamid}`;

                        if (instance.blacklist['steamIds'].includes(steamid)) {
                            str +=
                                client.intlGet(guildId, 'userAlreadyInBlacklist', {
                                    user: name,
                                }) + ' ';
                            successful = 1;
                        } else {
                            instance.blacklist['steamIds'].push(steamid);
                            client.setInstance(guildId, instance);
                            str +=
                                client.intlGet(guildId, 'userAddedToBlacklist', {
                                    user: name,
                                }) + ' ';
                        }
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `add, ${discordUser}, ${steamid}`,
                        }),
                        'info',
                    );

                    await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(successful, str));
                    client.log(client.intlGet(null, 'infoCap'), str, 'info');
                    return;
                }
                break;

            case 'remove':
                {
                    const discordUser = interaction.options.getUser('discord_user');
                    const steamid = interaction.options.getString('steamid');

                    if (discordUser === null && steamid === null) {
                        const str = client.intlGet(guildId, 'missingArguments');
                        await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
                        client.log(client.intlGet(null, 'warningCap'), str, 'warning');
                        return;
                    }

                    let successful = 0;

                    let str = '';
                    if (discordUser !== null) {
                        if (!instance.blacklist['discordIds'].includes(discordUser.id)) {
                            str +=
                                client.intlGet(guildId, 'userNotInBlacklist', {
                                    user: `${discordUser.username} (${discordUser.id})`,
                                }) + ' ';
                            successful = 1;
                        } else {
                            instance.blacklist['discordIds'] = instance.blacklist['discordIds'].filter(
                                (e: string) => e !== discordUser.id,
                            );
                            client.setInstance(guildId, instance);

                            await PermissionHandler.resetPermissionsAllChannels(client, guild!);

                            str +=
                                client.intlGet(guildId, 'userRemovedFromBlacklist', {
                                    user: `${discordUser.username} (${discordUser.id})`,
                                }) + ' ';
                        }
                    }

                    if (steamid !== null) {
                        let name = '';
                        const steamName = await Scrape.default.scrapeSteamProfileName(client, steamid);
                        if (steamName) name += `${steamName} (${steamid})`;
                        else name += `${steamid}`;

                        if (!instance.blacklist['steamIds'].includes(steamid)) {
                            str +=
                                client.intlGet(guildId, 'userNotInBlacklist', {
                                    user: name,
                                }) + ' ';
                            successful = 1;
                        } else {
                            instance.blacklist['steamIds'] = instance.blacklist['steamIds'].filter(
                                (e: string) => e !== steamid,
                            );
                            client.setInstance(guildId, instance);
                            str +=
                                client.intlGet(guildId, 'userRemovedFromBlacklist', {
                                    user: name,
                                }) + ' ';
                        }
                    }

                    client.log(
                        client.intlGet(null, 'infoCap'),
                        client.intlGet(null, 'slashCommandValueChange', {
                            id: `${verifyId}`,
                            value: `remove, ${discordUser}, ${steamid}`,
                        }),
                        'info',
                    );

                    await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(successful, str));
                    client.log(client.intlGet(null, 'infoCap'), str, 'info');
                    return;
                }
                break;

            case 'show':
                {
                    let discordUsers = '';
                    let steamIds = '';

                    for (const discordId of instance.blacklist['discordIds']) {
                        const user = await DiscordTools.getUserById(guildId, discordId);
                        let name = '';
                        if (user) name = `${user.user.username} (${user.id})`;
                        else name = `${discordId}`;

                        discordUsers += `${name}\n`;
                    }

                    for (const steamId of instance.blacklist['steamIds']) {
                        let name = '';
                        const steamName = await Scrape.default.scrapeSteamProfileName(client, steamId);
                        if (steamName) name = `${steamName} (${steamId})`;
                        else name = `${steamId}`;

                        steamIds += `${name}\n`;
                    }

                    await (client as any).interactionEditReply(interaction, {
                        embeds: [
                            DiscordEmbedsAny.getEmbed({
                                color: Constants.COLOR_DEFAULT,
                                title: client.intlGet(guildId, 'blacklist'),
                                fields: [
                                    {
                                        name: client.intlGet(guildId, 'discordUsers'),
                                        value: discordUsers === '' ? '\u200B' : discordUsers,
                                        inline: true,
                                    },
                                    {
                                        name: 'SteamId',
                                        value: steamIds === '' ? '\u200B' : steamIds,
                                        inline: true,
                                    },
                                ],
                            }),
                        ],
                        ephemeral: true,
                    });

                    client.log(client.intlGet(guildId, 'infoCap'), client.intlGet(guildId, 'showingBlacklist'), 'info');
                }
                break;

            default:
                {
                }
                break;
        }

        return;
    },
};