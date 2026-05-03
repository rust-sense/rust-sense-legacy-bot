import * as DiscordMessagesModule from '../discordTools/discordMessages.js';
import type DiscordBot from '../structures/DiscordBot.js';

const DiscordMessages: any = DiscordMessagesModule;

import * as DiscordSelectMenusModule from '../discordTools/discordSelectMenus.js';

const DiscordSelectMenus: any = DiscordSelectMenusModule;

import * as DiscordToolsModule from '../discordTools/discordTools.js';

const DiscordTools: any = DiscordToolsModule;

import * as Utils from '../discordTools/discordInteractionUtils.js';
import { getPersistenceCache } from '../persistence/index.js';

export default async (client: DiscordBot, interaction: any) => {
    const instance = await getPersistenceCache().readGuildState(interaction.guildId);
    const guildId = interaction.guildId;
    const rustplus = client.rustplusInstances[guildId];

    const verifyId = Utils.generateVerifyId().toString();
    client.logInteraction(interaction, verifyId, 'userSelectMenu');

    if (Utils.isBlacklisted(client, instance, interaction, verifyId)) return;

    if (interaction.customId === 'language') {
        instance.generalSettings.language = interaction.values[0];
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);

        if (rustplus) rustplus.generalSettings.language = interaction.values[0];

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.language}`,
            }),
        );

        await interaction.deferUpdate();

        client.loadGuildIntl(guildId, instance);

        await client.interactionEditReply(interaction, {
            components: [await DiscordSelectMenus.getLanguageSelectMenu(guildId, interaction.values[0])],
        });

        const guild = DiscordTools.getGuild(guildId);
        await (await import('../discordTools/RegisterSlashCommands.js')).default(client, guild);
    } else if (interaction.customId === 'Prefix') {
        instance.generalSettings.prefix = interaction.values[0];
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);

        if (rustplus) rustplus.generalSettings.prefix = interaction.values[0];

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.prefix}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getPrefixSelectMenu(guildId, interaction.values[0])],
        });
    } else if (interaction.customId === 'Trademark') {
        instance.generalSettings.trademark = interaction.values[0];
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);

        if (rustplus) {
            rustplus.generalSettings.trademark = interaction.values[0];
            rustplus.trademarkString =
                instance.generalSettings.trademark === 'NOT SHOWING' ? '' : `${instance.generalSettings.trademark} | `;
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.trademark}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getTrademarkSelectMenu(guildId, interaction.values[0])],
        });
    } else if (interaction.customId === 'CommandDelay') {
        instance.generalSettings.commandDelay = interaction.values[0];
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);

        if (rustplus) rustplus.generalSettings.commandDelay = interaction.values[0];

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.commandDelay}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getCommandDelaySelectMenu(guildId, interaction.values[0])],
        });
    } else if (interaction.customId === 'VoiceGender') {
        instance.generalSettings.voiceGender = interaction.values[0];
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);

        if (rustplus) rustplus.generalSettings.voiceGender = interaction.values[0];

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.voiceGender}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getVoiceGenderSelectMenu(guildId, interaction.values[0])],
        });
    } else if (interaction.customId === 'TTSProvider') {
        instance.generalSettings.ttsProvider = interaction.values[0];
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);

        if (rustplus) rustplus.generalSettings.ttsProvider = interaction.values[0];

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.ttsProvider}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: await DiscordSelectMenus.getTTSSettingsComponents(guildId),
        });
    } else if (interaction.customId === 'TTSVoice') {
        const provider = instance.generalSettings.ttsProvider ?? 'oddcast';
        if (provider === 'piper') {
            instance.generalSettings.piperVoice = interaction.values[0];
            if (rustplus) rustplus.generalSettings.piperVoice = interaction.values[0];
        } else {
            instance.generalSettings.voiceGender = interaction.values[0];
            if (rustplus) rustplus.generalSettings.voiceGender = interaction.values[0];
        }
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${interaction.values[0]}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: await DiscordSelectMenus.getTTSSettingsComponents(guildId),
        });
    } else if (interaction.customId.startsWith('AutoDayNightOnOff')) {
        const ids = JSON.parse(interaction.customId.replace('AutoDayNightOnOff', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.switches, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const value = parseInt(interaction.values[0]);
        if (
            (value !== 5 && value !== 6) ||
            ((value === 5 || value === 6) && server.switches[ids.entityId].location !== null)
        ) {
            server.switches[ids.entityId].autoDayNightOnOff = value;
            await getPersistenceCache().saveGuildStateChanges(guildId, instance);
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${server.switches[ids.entityId].autoDayNightOnOff}`,
            }),
        );

        await DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId, interaction);
    } else if (interaction.customId.startsWith('TeammateNameType')) {
        instance.generalSettings.teammateNameType = interaction.values[0];
        await getPersistenceCache().saveGuildStateChanges(guildId, instance);

        if (rustplus) {
            rustplus.generalSettings.teammateNameType = interaction.values[0];
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'selectMenuValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.teammateNameType}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getInGameTeammateNameMenu(guildId, interaction.values[0])],
        });
    }

    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, 'userSelectMenuInteractionSuccess', {
            id: `${verifyId}`,
        }),
    );
};
