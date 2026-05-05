import * as Discord from 'discord.js';
import * as Constants from '../domain/constants.js';
import { client } from '../index.js';
import { getPersistenceCache } from '../persistence/index.js';

const SUCCESS = Discord.ButtonStyle.Success;
const DANGER = Discord.ButtonStyle.Danger;
const PRIMARY = Discord.ButtonStyle.Primary;
const SECONDARY = Discord.ButtonStyle.Secondary;
const LINK = Discord.ButtonStyle.Link;

export function getButton(options: any = {}) {
    const button = new Discord.ButtonBuilder();

    if (Object.hasOwn(options, 'customId')) button.setCustomId(options.customId);
    if (Object.hasOwn(options, 'label')) button.setLabel(options.label);
    if (Object.hasOwn(options, 'style')) button.setStyle(options.style);
    if (Object.hasOwn(options, 'url') && options.url !== '') button.setURL(options.url);
    if (Object.hasOwn(options, 'emoji')) button.setEmoji(options.emoji);
    if (Object.hasOwn(options, 'disabled')) button.setDisabled(options.disabled);

    return button;
}

export async function getServerButtons(guildId: string, serverId: string, state: number | null = null) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const server: any = instance.serverList[serverId];
    const identifier = JSON.stringify({ serverId: serverId });

    if (state === null) {
        if (instance.activeServer === serverId && client.activeRustplusInstances[guildId]) {
            state = 1;
        } else {
            state = 0;
        }
    }

    let connectionButton = null;
    if (state === 0) {
        connectionButton = getButton({
            customId: `ServerConnect${identifier}`,
            label: client.intlGet(guildId, 'connectCap'),
            style: PRIMARY,
        });
    } else if (state === 1) {
        connectionButton = getButton({
            customId: `ServerDisconnect${identifier}`,
            label: client.intlGet(guildId, 'disconnectCap'),
            style: DANGER,
        });
    } else if (state === 2) {
        connectionButton = getButton({
            customId: `ServerReconnecting${identifier}`,
            label: client.intlGet(guildId, 'reconnectingCap'),
            style: DANGER,
        });
    }

    const deleteUnreachableDevicesButton = getButton({
        customId: `DeleteUnreachableDevices${identifier}`,
        label: client.intlGet(guildId, 'deleteUnreachableDevicesCap'),
        style: PRIMARY,
    });
    const customTimersButton = getButton({
        customId: `CustomTimersEdit${identifier}`,
        label: client.intlGet(guildId, 'customTimersCap'),
        style: PRIMARY,
    });
    const trackerButton = getButton({
        customId: `CreateTracker${identifier}`,
        label: client.intlGet(guildId, 'createTrackerCap'),
        style: PRIMARY,
    });
    const groupButton = getButton({
        customId: `CreateGroup${identifier}`,
        label: client.intlGet(guildId, 'createGroupCap'),
        style: PRIMARY,
    });
    let linkButton = getButton({
        label: client.intlGet(guildId, 'websiteCap'),
        style: LINK,
        url: server.url,
    });
    let battlemetricsButton = getButton({
        label: client.intlGet(guildId, 'battlemetricsCap'),
        style: LINK,
        url: `${Constants.BATTLEMETRICS_SERVER_URL}${server.battlemetricsId}`,
    });
    let editButton = getButton({
        customId: `ServerEdit${identifier}`,
        label: client.intlGet(guildId, 'editCap'),
        style: PRIMARY,
    });
    let deleteButton = getButton({
        customId: `ServerDelete${identifier}`,
        style: SECONDARY,
        emoji: '🗑️',
    });

    if (server.battlemetricsId !== null) {
        return [
            new Discord.ActionRowBuilder().addComponents(
                connectionButton,
                linkButton,
                battlemetricsButton,
                editButton,
                deleteButton,
            ),
            new Discord.ActionRowBuilder().addComponents(customTimersButton, trackerButton, groupButton),
            new Discord.ActionRowBuilder().addComponents(deleteUnreachableDevicesButton),
        ];
    } else {
        return [
            new Discord.ActionRowBuilder().addComponents(connectionButton, linkButton, editButton, deleteButton),
            new Discord.ActionRowBuilder().addComponents(customTimersButton, groupButton),
            new Discord.ActionRowBuilder().addComponents(deleteUnreachableDevicesButton),
        ];
    }
}

export async function getSmartSwitchButtons(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].switches[entityId];
    const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: `SmartSwitch${entity.active ? 'Off' : 'On'}${identifier}`,
            label: entity.active ? client.intlGet(guildId, 'turnOffCap') : client.intlGet(guildId, 'turnOnCap'),
            style: entity.active ? DANGER : SUCCESS,
        }),
        getButton({
            customId: `SmartSwitchEdit${identifier}`,
            label: client.intlGet(guildId, 'editCap'),
            style: PRIMARY,
        }),
        getButton({
            customId: `SmartSwitchDelete${identifier}`,
            style: SECONDARY,
            emoji: '🗑️',
        }),
    );
}

export function getSmartSwitchGroupButtons(guildId: string, serverId: string, groupId: string) {
    const identifier = JSON.stringify({ serverId: serverId, groupId: groupId });

    return [
        new Discord.ActionRowBuilder().addComponents(
            getButton({
                customId: `GroupTurnOn${identifier}`,
                label: client.intlGet(guildId, 'turnOnCap'),
                style: PRIMARY,
            }),
            getButton({
                customId: `GroupTurnOff${identifier}`,
                label: client.intlGet(guildId, 'turnOffCap'),
                style: PRIMARY,
            }),
            getButton({
                customId: `GroupEdit${identifier}`,
                label: client.intlGet(guildId, 'editCap'),
                style: PRIMARY,
            }),
            getButton({
                customId: `GroupDelete${identifier}`,
                style: SECONDARY,
                emoji: '🗑️',
            }),
        ),
        new Discord.ActionRowBuilder().addComponents(
            getButton({
                customId: `GroupAddSwitch${identifier}`,
                label: client.intlGet(guildId, 'addSwitchCap'),
                style: SUCCESS,
            }),
            getButton({
                customId: `GroupRemoveSwitch${identifier}`,
                label: client.intlGet(guildId, 'removeSwitchCap'),
                style: DANGER,
            }),
        ),
    ];
}

export async function getSmartAlarmButtons(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];
    const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: `SmartAlarmEveryone${identifier}`,
            label: '@everyone',
            style: entity.everyone ? SUCCESS : DANGER,
        }),
        getButton({
            customId: `SmartAlarmEdit${identifier}`,
            label: client.intlGet(guildId, 'editCap'),
            style: PRIMARY,
        }),
        getButton({
            customId: `SmartAlarmDelete${identifier}`,
            style: SECONDARY,
            emoji: '🗑️',
        }),
    );
}

export async function getStorageMonitorToolCupboardButtons(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: `StorageMonitorToolCupboardEveryone${identifier}`,
            label: '@everyone',
            style: entity.everyone ? SUCCESS : DANGER,
        }),
        getButton({
            customId: `StorageMonitorToolCupboardInGame${identifier}`,
            label: client.intlGet(guildId, 'inGameCap'),
            style: entity.inGame ? SUCCESS : DANGER,
        }),
        getButton({
            customId: `StorageMonitorEdit${identifier}`,
            label: client.intlGet(guildId, 'editCap'),
            style: PRIMARY,
        }),
        getButton({
            customId: `StorageMonitorToolCupboardDelete${identifier}`,
            style: SECONDARY,
            emoji: '🗑️',
        }),
    );
}

export function getStorageMonitorContainerButton(guildId: string, serverId: string, entityId: string) {
    const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: `StorageMonitorEdit${identifier}`,
            label: client.intlGet(guildId, 'editCap'),
            style: PRIMARY,
        }),
        getButton({
            customId: `StorageMonitorRecycle${identifier}`,
            label: client.intlGet(guildId, 'recycleCap'),
            style: PRIMARY,
        }),
        getButton({
            customId: `StorageMonitorContainerDelete${identifier}`,
            style: SECONDARY,
            emoji: '🗑️',
        }),
    );
}

export function getRecycleDeleteButton() {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'RecycleDelete',
            style: SECONDARY,
            emoji: '🗑️',
        }),
    );
}

export function getNotificationButtons(
    guildId: string,
    setting: string,
    discordActive: boolean,
    inGameActive: boolean,
    voiceActive: boolean,
) {
    const identifier = JSON.stringify({ setting: setting });

    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: `DiscordNotification${identifier}`,
            label: client.intlGet(guildId, 'discordCap'),
            style: discordActive ? SUCCESS : DANGER,
        }),
        getButton({
            customId: `InGameNotification${identifier}`,
            label: client.intlGet(guildId, 'inGameCap'),
            style: inGameActive ? SUCCESS : DANGER,
        }),
        getButton({
            customId: `VoiceNotification${identifier}`,
            label: client.intlGet(guildId, 'voiceCap'),
            style: voiceActive ? SUCCESS : DANGER,
        }),
    );
}

export function getInGameCommandsEnabledButton(guildId: string, enabled: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'AllowInGameCommands',
            label: enabled ? client.intlGet(guildId, 'enabledCap') : client.intlGet(guildId, 'disabledCap'),
            style: enabled ? SUCCESS : DANGER,
        }),
    );
}

export async function getInGameTeammateNotificationsButtons(guildId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'InGameTeammateConnection',
            label: client.intlGet(guildId, 'connectionsCap'),
            style: instance.generalSettings.connectionNotify ? SUCCESS : DANGER,
        }),
        getButton({
            customId: 'InGameTeammateAfk',
            label: client.intlGet(guildId, 'afkCap'),
            style: instance.generalSettings.afkNotify ? SUCCESS : DANGER,
        }),
        getButton({
            customId: 'InGameTeammateDeath',
            label: client.intlGet(guildId, 'deathCap'),
            style: instance.generalSettings.deathNotify ? SUCCESS : DANGER,
        }),
    );
}

export function getFcmAlarmNotificationButtons(guildId: string, enabled: boolean, everyone: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'FcmAlarmNotification',
            label: enabled ? client.intlGet(guildId, 'enabledCap') : client.intlGet(guildId, 'disabledCap'),
            style: enabled ? SUCCESS : DANGER,
        }),
        getButton({
            customId: 'FcmAlarmNotificationEveryone',
            label: '@everyone',
            style: everyone ? SUCCESS : DANGER,
        }),
    );
}

export function getSmartAlarmNotifyInGameButton(guildId: string, enabled: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'SmartAlarmNotifyInGame',
            label: enabled ? client.intlGet(guildId, 'enabledCap') : client.intlGet(guildId, 'disabledCap'),
            style: enabled ? SUCCESS : DANGER,
        }),
    );
}

export function getSmartSwitchNotifyInGameWhenChangedFromDiscordButton(guildId: string, enabled: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'SmartSwitchNotifyInGameWhenChangedFromDiscord',
            label: enabled ? client.intlGet(guildId, 'enabledCap') : client.intlGet(guildId, 'disabledCap'),
            style: enabled ? SUCCESS : DANGER,
        }),
    );
}

export function getLeaderCommandEnabledButton(guildId: string, enabled: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'LeaderCommandEnabled',
            label: enabled ? client.intlGet(guildId, 'enabledCap') : client.intlGet(guildId, 'disabledCap'),
            style: enabled ? SUCCESS : DANGER,
        }),
    );
}

export function getLeaderCommandOnlyForPairedButton(guildId: string, enabled: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'LeaderCommandOnlyForPaired',
            label: enabled ? client.intlGet(guildId, 'enabledCap') : client.intlGet(guildId, 'disabledCap'),
            style: enabled ? SUCCESS : DANGER,
        }),
    );
}

export async function getTrackerButtons(guildId: string, trackerId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const tracker: any = instance.trackers[trackerId];
    const identifier = JSON.stringify({ trackerId: trackerId });

    return [
        new Discord.ActionRowBuilder().addComponents(
            getButton({
                customId: `TrackerAddPlayer${identifier}`,
                label: client.intlGet(guildId, 'addPlayerCap'),
                style: SUCCESS,
            }),
            getButton({
                customId: `TrackerRemovePlayer${identifier}`,
                label: client.intlGet(guildId, 'removePlayerCap'),
                style: DANGER,
            }),
            getButton({
                customId: `TrackerEdit${identifier}`,
                label: client.intlGet(guildId, 'editCap'),
                style: PRIMARY,
            }),
            getButton({
                customId: `TrackerDelete${identifier}`,
                style: SECONDARY,
                emoji: '🗑️',
            }),
        ),
        new Discord.ActionRowBuilder().addComponents(
            getButton({
                customId: `TrackerInGame${identifier}`,
                label: client.intlGet(guildId, 'inGameCap'),
                style: tracker.inGame ? SUCCESS : DANGER,
            }),
            getButton({
                customId: `TrackerEveryone${identifier}`,
                label: '@everyone',
                style: tracker.everyone ? SUCCESS : DANGER,
            }),
            getButton({
                customId: `TrackerUpdate${identifier}`,
                label: client.intlGet(guildId, 'updateCap'),
                style: PRIMARY,
            }),
        ),
    ];
}

export function getNewsButton(guildId: string, body: any, validURL: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            style: LINK,
            label: client.intlGet(guildId, 'linkCap'),
            url: validURL ? body.url : Constants.DEFAULT_SERVER_URL,
        }),
    );
}

export function getBotMutedInGameButton(guildId: string, isMuted: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'BotMutedInGame',
            label: isMuted ? client.intlGet(guildId, 'mutedCap') : client.intlGet(guildId, 'unmutedCap'),
            style: isMuted ? DANGER : SUCCESS,
        }),
    );
}

export function getMapWipeNotifyEveryoneButton(everyone: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'MapWipeNotifyEveryone',
            label: '@everyone',
            style: everyone ? SUCCESS : DANGER,
        }),
    );
}

export function getItemAvailableNotifyInGameButton(guildId: string, enabled: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'ItemAvailableNotifyInGame',
            label: enabled ? client.intlGet(guildId, 'enabledCap') : client.intlGet(guildId, 'disabledCap'),
            style: enabled ? SUCCESS : DANGER,
        }),
    );
}

export function getHelpButtons() {
    return [
        new Discord.ActionRowBuilder().addComponents(
            getButton({
                style: Discord.ButtonStyle.Link,
                label: 'ORIGINAL DEVELOPER',
                url: 'https://github.com/alexemanuelol',
            }),
            getButton({
                style: Discord.ButtonStyle.Link,
                label: 'FORK DEVELOPER',
                url: 'https://github.com/faithix',
            }),
            getButton({
                style: Discord.ButtonStyle.Link,
                label: 'REPOSITORY',
                url: 'https://github.com/rust-sense/bot',
            }),
        ),
        new Discord.ActionRowBuilder().addComponents(
            getButton({
                style: Discord.ButtonStyle.Link,
                label: 'DOCUMENTATION',
                url: 'https://github.com/rust-sense/bot/blob/develop/docs/documentation.md',
            }),
            getButton({
                style: Discord.ButtonStyle.Link,
                label: 'CREDENTIALS',
                url: 'https://rust-sense-credentials.netlify.app/',
            }),
        ),
    ];
}

export function getDisplayInformationBattlemetricsAllOnlinePlayersButton(guildId: string, enabled: boolean) {
    return new Discord.ActionRowBuilder().addComponents(
        getButton({
            customId: 'DisplayInformationBattlemetricsAllOnlinePlayers',
            label: enabled ? client.intlGet(guildId, 'enabledCap') : client.intlGet(guildId, 'disabledCap'),
            style: enabled ? SUCCESS : DANGER,
        }),
    );
}

export async function getSubscribeToChangesBattlemetricsButtons(guildId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    return [
        new Discord.ActionRowBuilder().addComponents(
            getButton({
                customId: 'BattlemetricsServerNameChanges',
                label: client.intlGet(guildId, 'battlemetricsServerNameChangesCap'),
                style: instance.generalSettings.battlemetricsServerNameChanges ? SUCCESS : DANGER,
            }),
            getButton({
                customId: 'BattlemetricsTrackerNameChanges',
                label: client.intlGet(guildId, 'battlemetricsTrackerNameChangesCap'),
                style: instance.generalSettings.battlemetricsTrackerNameChanges ? SUCCESS : DANGER,
            }),
            getButton({
                customId: 'BattlemetricsGlobalNameChanges',
                label: client.intlGet(guildId, 'battlemetricsGlobalNameChangesCap'),
                style: instance.generalSettings.battlemetricsGlobalNameChanges ? SUCCESS : DANGER,
            }),
        ),
        new Discord.ActionRowBuilder().addComponents(
            getButton({
                customId: 'BattlemetricsGlobalLogin',
                label: client.intlGet(guildId, 'battlemetricsGlobalLoginCap'),
                style: instance.generalSettings.battlemetricsGlobalLogin ? SUCCESS : DANGER,
            }),
            getButton({
                customId: 'BattlemetricsGlobalLogout',
                label: client.intlGet(guildId, 'battlemetricsGlobalLogoutCap'),
                style: instance.generalSettings.battlemetricsGlobalLogout ? SUCCESS : DANGER,
            }),
        ),
    ];
}
