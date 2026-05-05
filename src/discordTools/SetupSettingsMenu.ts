import * as Discord from 'discord.js';
import * as Constants from '../domain/constants.js';
import { getPersistenceCache } from '../persistence/index.js';
import type DiscordBot from '../structures/DiscordBot.js';
import { cwdPath } from '../utils/filesystemUtils.js';
import * as DiscordButtons from './discordButtons.js';
import * as DiscordEmbeds from './discordEmbeds.js';
import * as DiscordSelectMenus from './discordSelectMenus.js';
import * as DiscordTools from './discordTools.js';

export default async (client: DiscordBot, guild: any, forced: boolean = false) => {
    const instance = await getPersistenceCache().readGuildState(guild.id);
    const channel = DiscordTools.getTextChannelById(guild.id, instance.channelId.settings);

    if (!channel) {
        client.log(
            client.intlGet(null, 'errorCap'),
            'SetupSettingsMenu: ' + client.intlGet(null, 'invalidGuildOrChannel'),
            'error',
        );
        return;
    }

    if (instance.firstTime || forced) {
        await DiscordTools.clearTextChannel(guild.id, instance.channelId.settings, 100);

        await setupGeneralSettings(client, guild.id, channel);
        await setupNotificationSettings(client, guild.id, channel);

        instance.firstTime = false;
        await getPersistenceCache().markFirstTimeComplete(guild.id);
    }
};

async function setupGeneralSettings(client: DiscordBot, guildId: string, channel: any) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    await client.messageSend(channel, {
        files: [
            new Discord.AttachmentBuilder(
                cwdPath(`resources/images/settings/general_settings_logo_${instance.generalSettings.language}.png`),
            ),
        ],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'selectLanguageSetting'),
                thumbnail: `attachment://settings_logo.png`,
                fields: [
                    {
                        name: client.intlGet(guildId, 'noteCap'),
                        value: client.intlGet(guildId, 'selectLanguageExtendSetting'),
                        inline: true,
                    },
                ],
            }),
        ],
        components: [await DiscordSelectMenus.getLanguageSelectMenu(guildId, instance.generalSettings.language)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: 'TTS Provider & Voice',
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: await DiscordSelectMenus.getTTSSettingsComponents(guildId),
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'selectInGamePrefixSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [DiscordSelectMenus.getPrefixSelectMenu(guildId, instance.generalSettings.prefix)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'selectTrademarkSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [DiscordSelectMenus.getTrademarkSelectMenu(guildId, instance.generalSettings.trademark)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'shouldCommandsEnabledSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [
            DiscordButtons.getInGameCommandsEnabledButton(guildId, instance.generalSettings.inGameCommandsEnabled),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'shouldBotBeMutedSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [DiscordButtons.getBotMutedInGameButton(guildId, instance.generalSettings.muteInGameBotMessages)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'inGameTeamNotificationsSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [await DiscordButtons.getInGameTeammateNotificationsButtons(guildId)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'selectInGameTeammateNameSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [DiscordSelectMenus.getInGameTeammateNameMenu(guildId, instance.generalSettings.teammateNameType)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'commandDelaySetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [DiscordSelectMenus.getCommandDelaySelectMenu(guildId, instance.generalSettings.commandDelay)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'shouldSmartAlarmNotifyNotConnectedSetting'),
                thumbnail: `attachment://settings_logo.png`,
                fields: [
                    {
                        name: client.intlGet(guildId, 'noteCap'),
                        value: client.intlGet(guildId, 'smartAlarmNotifyExtendSetting'),
                        inline: true,
                    },
                ],
            }),
        ],
        components: [
            DiscordButtons.getFcmAlarmNotificationButtons(
                guildId,
                instance.generalSettings.fcmAlarmNotificationEnabled,
                instance.generalSettings.fcmAlarmNotificationEveryone,
            ),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'shouldSmartAlarmsNotifyInGameSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [
            DiscordButtons.getSmartAlarmNotifyInGameButton(guildId, instance.generalSettings.smartAlarmNotifyInGame),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'shouldSmartSwitchNotifyInGameWhenChangedFromDiscord'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [
            DiscordButtons.getSmartSwitchNotifyInGameWhenChangedFromDiscordButton(
                guildId,
                instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord,
            ),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'shouldLeaderCommandEnabledSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [
            DiscordButtons.getLeaderCommandEnabledButton(guildId, instance.generalSettings.leaderCommandEnabled),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'shouldLeaderCommandOnlyForPairedSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [
            DiscordButtons.getLeaderCommandOnlyForPairedButton(
                guildId,
                instance.generalSettings.leaderCommandOnlyForPaired,
            ),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'mapWipeDetectedNotifySetting', { group: '@everyone' }),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [DiscordButtons.getMapWipeNotifyEveryoneButton(instance.generalSettings.mapWipeNotifyEveryone)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'itemAvailableNotifyInGameSetting'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [
            DiscordButtons.getItemAvailableNotifyInGameButton(
                guildId,
                instance.generalSettings.itemAvailableInVendingMachineNotifyInGame,
            ),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'displayInformationBattlemetricsAllOnlinePlayers'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: [
            DiscordButtons.getDisplayInformationBattlemetricsAllOnlinePlayersButton(
                guildId,
                instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers,
            ),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });

    await client.messageSend(channel, {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: Constants.COLOR_SETTINGS,
                title: client.intlGet(guildId, 'subscribeToChangesBattlemetrics'),
                thumbnail: `attachment://settings_logo.png`,
            }),
        ],
        components: await DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId),
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/settings_logo.png'))],
    });
}

async function setupNotificationSettings(client: DiscordBot, guildId: string, channel: any) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    await client.messageSend(channel, {
        files: [
            new Discord.AttachmentBuilder(
                cwdPath(
                    `resources/images/settings/notification_settings_logo_${instance.generalSettings.language}.png`,
                ),
            ),
        ],
    });

    for (const setting in instance.notificationSettings) {
        await client.messageSend(channel, {
            embeds: [
                DiscordEmbeds.getEmbed({
                    color: Constants.COLOR_SETTINGS,
                    title: client.intlGet(guildId, setting),
                    thumbnail: `attachment://${instance.notificationSettings[setting].image}`,
                }),
            ],
            components: [
                DiscordButtons.getNotificationButtons(
                    guildId,
                    setting,
                    instance.notificationSettings[setting].discord as boolean,
                    instance.notificationSettings[setting].inGame as boolean,
                    instance.notificationSettings[setting].voice as boolean,
                ),
            ],
            files: [
                new Discord.AttachmentBuilder(
                    cwdPath(`resources/images/events/${instance.notificationSettings[setting].image}`),
                ),
            ],
        });
    }
}
