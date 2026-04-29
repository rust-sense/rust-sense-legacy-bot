import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import type DiscordBot from '../structures/DiscordBot.js';
import * as InstanceUtils from '../util/instanceUtils.js';

export default {
    name: 'credentials',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('credentials')
            .setDescription(client.intlGet(guildId, 'commandsCredentialsDesc'))
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('add')
                    .setDescription(client.intlGet(guildId, 'commandsCredentialsAddDesc'))
                    .addStringOption((option) =>
                        option.setName('gcm_android_id').setDescription('GCM Android ID.').setRequired(true),
                    )
                    .addStringOption((option) =>
                        option.setName('gcm_security_token').setDescription('GCM Security Token.').setRequired(true),
                    )
                    .addStringOption((option) =>
                        option.setName('steam_id').setDescription('Steam ID.').setRequired(true),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('issued_date')
                            .setDescription('Issued date of the credentials.')
                            .setRequired(true),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('expire_date')
                            .setDescription('Expire date of the credentials.')
                            .setRequired(true),
                    )
                    .addBooleanOption((option) =>
                        option.setName('host').setDescription('Host the bot').setRequired(false),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('remove')
                    .setDescription(client.intlGet(guildId, 'commandsCredentialsRemoveDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('steam_id')
                            .setDescription(client.intlGet(guildId, 'commandsCredentialsRemoveSteamIdDesc'))
                            .setRequired(false),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('show').setDescription(client.intlGet(guildId, 'commandsCredentialsShowDesc')),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('set_hoster')
                    .setDescription(client.intlGet(guildId, 'commandsCredentialsSetHosterDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('steam_id')
                            .setDescription(client.intlGet(guildId, 'commandsCredentialsSetHosterSteamIdDesc'))
                            .setRequired(false),
                    ),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        switch (interaction.options.getSubcommand()) {
            case 'add':
                {
                    addCredentials(client, interaction, verifyId);
                }
                break;

            case 'remove':
                {
                    removeCredentials(client, interaction, verifyId);
                }
                break;

            case 'show':
                {
                    showCredentials(client, interaction, verifyId);
                }
                break;

            case 'set_hoster':
                {
                    setHosterCredentials(client, interaction, verifyId);
                }
                break;

            default:
                {
                }
                break;
        }
    },
};

async function addCredentials(client: DiscordBot, interaction: any, verifyId: string) {
    const guildId = interaction.guildId;
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const steamId = interaction.options.getString('steam_id');
    const isHoster = interaction.options.getBoolean('host') || Object.keys(credentials).length === 1;

    if (Object.keys(credentials).length !== 1 && isHoster) {
        if (!client.isAdministrator(interaction)) {
            const str = client.intlGet(interaction.guildId, 'missingPermission');
            client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warn');
            return;
        }
    }

    if (steamId in credentials) {
        const str = client.intlGet(guildId, 'credentialsAlreadyRegistered', {
            steamId: steamId,
        });
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(null, 'warningCap'), str, 'warn');
        return;
    }

    credentials[steamId] = {};
    credentials[steamId].gcm = {};
    credentials[steamId].gcm.android_id = interaction.options.getString('gcm_android_id');
    credentials[steamId].gcm.security_token = interaction.options.getString('gcm_security_token');
    credentials[steamId].issued_date = interaction.options.getString('issued_date');
    credentials[steamId].expire_date = interaction.options.getString('expire_date');
    credentials[steamId].discord_user_id = interaction.member.user.id;

    const prevHoster = credentials.hoster;
    if (isHoster) credentials.hoster = steamId;

    InstanceUtils.writeCredentialsFile(guildId, credentials);

    /* Start Fcm Listener */
    const FcmListener = await import('../util/FcmListener.js');
    if (isHoster) {
        await FcmListener.default(client, DiscordTools.getGuild(interaction.guildId));
        if (prevHoster !== null) {
            await FcmListener.default(client, DiscordTools.getGuild(interaction.guildId), prevHoster);
        }
    } else {
        await FcmListener.default(client, DiscordTools.getGuild(interaction.guildId), steamId);

        const rustplus = client.rustplusInstances[guildId];
        if (rustplus && rustplus.team.leaderSteamId === steamId) {
            rustplus.updateLeaderRustPlusLiteInstance();
        }
    }

    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, 'slashCommandValueChange', {
            id: `${verifyId}`,
            value:
                `add, ${steamId}, ` +
                `${credentials[steamId].discord_user_id}, ` +
                `${isHoster}, ` +
                `${credentials[steamId].gcm.android_id}, ` +
                `${credentials[steamId].gcm.security_token}, ` +
                `${credentials[steamId].issued_date}, ` +
                `${credentials[steamId].expire_date}`,
        }),
        'info',
    );

    const str = client.intlGet(interaction.guildId, 'credentialsAddedSuccessfully', { steamId: steamId });
    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
    client.log(client.intlGet(null, 'infoCap'), str, 'info');
}

async function removeCredentials(client: DiscordBot, interaction: any, verifyId: string) {
    const guildId = interaction.guildId;
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    let steamId = interaction.options.getString('steam_id');

    if (steamId && steamId in credentials && credentials[steamId].discord_user_id !== interaction.member.user.id) {
        if (!client.isAdministrator(interaction)) {
            const str = client.intlGet(interaction.guildId, 'missingPermission');
            client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warn');
            return;
        }
    }

    if (!steamId) {
        for (const credential of Object.keys(credentials)) {
            if (credential === 'hoster') continue;

            if (credentials[credential].discord_user_id === interaction.member.user.id) {
                steamId = credential;
                break;
            }
        }
    }

    if (!(steamId in credentials)) {
        const str = client.intlGet(guildId, 'credentialsDoNotExist', {
            steamId: steamId ? steamId : client.intlGet(guildId, 'unknown'),
        });
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(null, 'warningCap'), str, 'warn');
        return;
    }

    if (steamId === credentials.hoster) {
        if (client.fcmListeners[guildId]) {
            (client.fcmListeners[guildId] as { destroy: () => void }).destroy();
        }
        delete client.fcmListeners[guildId];
        credentials.hoster = null;
    } else {
        if (client.fcmListenersLite[guildId][steamId]) {
            (client.fcmListenersLite[guildId][steamId] as { destroy: () => void }).destroy();
        }
        delete client.fcmListenersLite[guildId][steamId];
    }

    delete credentials[steamId];
    InstanceUtils.writeCredentialsFile(guildId, credentials);

    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, 'slashCommandValueChange', {
            id: `${verifyId}`,
            value: `remove, ${steamId}`,
        }),
        'info',
    );

    const str = client.intlGet(guildId, 'credentialsRemovedSuccessfully', {
        steamId: steamId,
    });
    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
    client.log(client.intlGet(null, 'infoCap'), str, 'info');
}

async function showCredentials(client: DiscordBot, interaction: any, verifyId: string) {
    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, 'slashCommandValueChange', {
            id: `${verifyId}`,
            value: `show`,
        }),
        'info',
    );

    await DiscordMessages.sendCredentialsShowMessage(interaction);
}

async function setHosterCredentials(client: DiscordBot, interaction: any, verifyId: string) {
    const guildId = interaction.guildId;
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    let steamId = interaction.options.getString('steam_id');

    if (!client.isAdministrator(interaction)) {
        const str = client.intlGet(interaction.guildId, 'missingPermission');
        client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(null, 'warningCap'), str, 'warn');
        return;
    }

    if (!steamId) {
        steamId = Object.keys(credentials).find((e) => credentials[e]?.discord_user_id === interaction.member.user.id);
    }

    if (!(steamId in credentials)) {
        const str = client.intlGet(guildId, 'credentialsDoNotExist', {
            steamId: steamId ? steamId : client.intlGet(guildId, 'unknown'),
        });
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(null, 'warningCap'), str, 'warn');
        return;
    }

    const prevHoster = credentials.hoster;
    credentials.hoster = steamId;
    InstanceUtils.writeCredentialsFile(guildId, credentials);

    const instance = client.getInstance(guildId);
    const rustplus = client.rustplusInstances[guildId];
    if (rustplus) {
        instance.activeServer = null;
        client.setInstance(guildId, instance);
        client.resetRustplusVariables(guildId);
        rustplus.disconnect();
        delete client.rustplusInstances[guildId];
        await DiscordMessages.sendServerMessage(guildId, rustplus.serverId);
    }

    const FcmListener = await import('../util/FcmListener.js');
    await FcmListener.default(client, DiscordTools.getGuild(interaction.guildId));
    if (prevHoster !== null) {
        await FcmListener.default(client, DiscordTools.getGuild(interaction.guildId), prevHoster);
    }

    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, 'slashCommandValueChange', {
            id: `${verifyId}`,
            value: `setHoster, ${steamId}`,
        }),
        'info',
    );

    const str = client.intlGet(guildId, 'credentialsSetHosterSuccessfully', {
        steamId: steamId,
    });
    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
    client.log(client.intlGet(null, 'infoCap'), str, 'info');
}
