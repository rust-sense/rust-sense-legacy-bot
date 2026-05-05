import * as Discord from 'discord.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import type DiscordBot from '../structures/DiscordBot.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as SmartSwitchGroupHandler from '../services/smartSwitchGroupService.js';
import * as DiscordButtons from '../discordTools/discordButtons.js';
import * as DiscordModals from '../discordTools/discordModals.js';
import * as DiscordFormattingUtils from '../discordTools/discordFormattingUtils.js';
import * as Utils from '../discordTools/discordInteractionUtils.js';
import { getPersistenceCache } from '../persistence/index.js';
import type { ServerPatch } from '../persistence/types.js';
import type { Instance, Server } from '../types/instance.js';

async function persistTargetedButtonState(guildId: string, base: Instance, next: Instance): Promise<void> {
    const persistence = getPersistenceCache();

    if (
        !sameJson(base.generalSettings, next.generalSettings) ||
        !sameJson(base.notificationSettings, next.notificationSettings)
    ) {
        await persistence.setGuildSettingsFromState(guildId, next);
    }

    if (
        base.activeServer !== next.activeServer ||
        base.firstTime !== next.firstTime ||
        base.role !== next.role ||
        base.adminRole !== next.adminRole
    ) {
        await persistence.updateGuildCoreFields(guildId, {
            activeServer: next.activeServer,
            adminRole: next.adminRole,
            firstTime: next.firstTime,
            role: next.role,
        });
    }

    for (const serverId of unionKeys(base.serverList, next.serverList)) {
        const baseServer = base.serverList[serverId];
        const nextServer = next.serverList[serverId];
        if (!nextServer) {
            await persistence.deleteServer(guildId, serverId);
            continue;
        }
        if (!baseServer) {
            await persistence.upsertServer(guildId, serverId, nextServer);
            continue;
        }

        await persistServerDiff(guildId, serverId, baseServer, nextServer);
    }

    for (const trackerId of unionKeys(base.trackers, next.trackers)) {
        const baseTracker = base.trackers[trackerId];
        const nextTracker = next.trackers[trackerId];
        if (!nextTracker) {
            await persistence.deleteTracker(guildId, trackerId);
        } else if (!baseTracker || !sameJson(baseTracker, nextTracker)) {
            await persistence.upsertTracker(guildId, trackerId, nextTracker);
        }
    }
}

async function persistServerDiff(
    guildId: string,
    serverId: string,
    baseServer: Server,
    nextServer: Server,
): Promise<void> {
    const persistence = getPersistenceCache();
    const baseScalars = serverScalarSnapshot(baseServer);
    const nextScalars = serverScalarSnapshot(nextServer);
    if (!sameJson(baseScalars, nextScalars)) {
        await persistence.updateServerFields(guildId, serverId, nextScalars);
    }

    for (const switchId of unionKeys(baseServer.switches, nextServer.switches)) {
        const nextSwitch = nextServer.switches[Number(switchId)];
        if (!nextSwitch) {
            await persistence.deleteSmartSwitch(guildId, serverId, switchId);
        } else if (!sameJson(baseServer.switches[Number(switchId)], nextSwitch)) {
            await persistence.upsertSmartSwitch(guildId, serverId, switchId, nextSwitch);
        }
    }

    for (const alarmId of unionKeys(baseServer.alarms, nextServer.alarms)) {
        const nextAlarm = nextServer.alarms[Number(alarmId)];
        if (!nextAlarm) {
            await persistence.deleteSmartAlarm(guildId, serverId, alarmId);
        } else if (!sameJson(baseServer.alarms[Number(alarmId)], nextAlarm)) {
            await persistence.upsertSmartAlarm(guildId, serverId, alarmId, nextAlarm);
        }
    }

    for (const storageMonitorId of unionKeys(baseServer.storageMonitors, nextServer.storageMonitors)) {
        const nextStorageMonitor = nextServer.storageMonitors[Number(storageMonitorId)];
        if (!nextStorageMonitor) {
            await persistence.deleteStorageMonitor(guildId, serverId, storageMonitorId);
        } else if (!sameJson(baseServer.storageMonitors[Number(storageMonitorId)], nextStorageMonitor)) {
            await persistence.upsertStorageMonitor(guildId, serverId, storageMonitorId, nextStorageMonitor);
        }
    }

    for (const groupId of unionKeys(baseServer.switchGroups, nextServer.switchGroups)) {
        const nextGroup = nextServer.switchGroups[Number(groupId)];
        if (!nextGroup) {
            await persistence.deleteSmartSwitchGroup(guildId, serverId, groupId);
        } else if (!sameJson(baseServer.switchGroups[Number(groupId)], nextGroup)) {
            await persistence.upsertSmartSwitchGroup(guildId, serverId, groupId, nextGroup);
        }
    }
}

function serverScalarSnapshot(server: Server): ServerPatch {
    return {
        battlemetricsId: server.battlemetricsId,
        cargoShipEgressTimeMs: server.cargoShipEgressTimeMs,
        connect: server.connect ?? null,
        deepSeaMaxWipeCooldownMs: server.deepSeaMaxWipeCooldownMs,
        deepSeaMinWipeCooldownMs: server.deepSeaMinWipeCooldownMs,
        deepSeaWipeDurationMs: server.deepSeaWipeDurationMs,
        oilRigLockedCrateUnlockTimeMs: server.oilRigLockedCrateUnlockTimeMs,
    };
}

function sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function unionKeys<T extends object>(left: T | undefined, right: T | undefined): string[] {
    return Array.from(new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]));
}

export default async (client: DiscordBot, interaction: any) => {
    const instance = await getPersistenceCache().readGuildState(interaction.guildId);
    let persistedSnapshot = structuredClone(instance);
    const persistButtonState = async () => {
        await persistTargetedButtonState(interaction.guildId, persistedSnapshot, instance);
        persistedSnapshot = structuredClone(instance);
    };
    const guildId = interaction.guildId;
    const rustplus = client.rustplusInstances[guildId];

    const verifyId = Utils.generateVerifyId().toString();
    client.logInteraction(interaction, verifyId, 'userButton');

    if (Utils.isBlacklisted(client, instance, interaction, verifyId)) return;

    if (interaction.customId.startsWith('DiscordNotification')) {
        const ids = JSON.parse(interaction.customId.replace('DiscordNotification', ''));
        const setting = instance.notificationSettings[ids.setting];

        setting.discord = !setting.discord;
        await persistButtonState();

        if (rustplus) rustplus.notificationSettings[ids.setting].discord = setting.discord;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${setting.discord}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getNotificationButtons(
                    guildId,
                    ids.setting,
                    setting.discord as boolean,
                    setting.inGame as boolean,
                    setting.voice as boolean,
                ),
            ],
        });
    } else if (interaction.customId.startsWith('InGameNotification')) {
        const ids = JSON.parse(interaction.customId.replace('InGameNotification', ''));
        const setting = instance.notificationSettings[ids.setting];

        setting.inGame = !setting.inGame;
        await persistButtonState();

        if (rustplus) rustplus.notificationSettings[ids.setting].inGame = setting.inGame;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${setting.inGame}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getNotificationButtons(
                    guildId,
                    ids.setting,
                    setting.discord as boolean,
                    setting.inGame as boolean,
                    setting.voice as boolean,
                ),
            ],
        });
    } else if (interaction.customId.startsWith('VoiceNotification')) {
        const ids = JSON.parse(interaction.customId.replace('VoiceNotification', ''));
        const setting = instance.notificationSettings[ids.setting];

        setting.voice = !setting.voice;
        await persistButtonState();

        if (rustplus) rustplus.notificationSettings[ids.setting].voice = setting.voice;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${setting.voice}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getNotificationButtons(
                    guildId,
                    ids.setting,
                    setting.discord as boolean,
                    setting.inGame as boolean,
                    setting.voice as boolean,
                ),
            ],
        });
    } else if (interaction.customId === 'AllowInGameCommands') {
        instance.generalSettings.inGameCommandsEnabled = !instance.generalSettings.inGameCommandsEnabled;
        await persistButtonState();

        if (rustplus) rustplus.generalSettings.inGameCommandsEnabled = instance.generalSettings.inGameCommandsEnabled;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.inGameCommandsEnabled}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getInGameCommandsEnabledButton(guildId, instance.generalSettings.inGameCommandsEnabled),
            ],
        });
    } else if (interaction.customId === 'BotMutedInGame') {
        instance.generalSettings.muteInGameBotMessages = !instance.generalSettings.muteInGameBotMessages;
        await persistButtonState();

        if (rustplus) rustplus.generalSettings.muteInGameBotMessages = instance.generalSettings.muteInGameBotMessages;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.muteInGameBotMessages}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getBotMutedInGameButton(guildId, instance.generalSettings.muteInGameBotMessages),
            ],
        });
    } else if (interaction.customId === 'InGameTeammateConnection') {
        instance.generalSettings.connectionNotify = !instance.generalSettings.connectionNotify;
        await persistButtonState();

        if (rustplus) rustplus.generalSettings.connectionNotify = instance.generalSettings.connectionNotify;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.connectionNotify}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [await DiscordButtons.getInGameTeammateNotificationsButtons(guildId)],
        });
    } else if (interaction.customId === 'InGameTeammateAfk') {
        instance.generalSettings.afkNotify = !instance.generalSettings.afkNotify;
        await persistButtonState();

        if (rustplus) rustplus.generalSettings.afkNotify = instance.generalSettings.afkNotify;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.afkNotify}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [await DiscordButtons.getInGameTeammateNotificationsButtons(guildId)],
        });
    } else if (interaction.customId === 'InGameTeammateDeath') {
        instance.generalSettings.deathNotify = !instance.generalSettings.deathNotify;
        await persistButtonState();

        if (rustplus) rustplus.generalSettings.deathNotify = instance.generalSettings.deathNotify;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.deathNotify}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [await DiscordButtons.getInGameTeammateNotificationsButtons(guildId)],
        });
    } else if (interaction.customId === 'FcmAlarmNotification') {
        instance.generalSettings.fcmAlarmNotificationEnabled = !instance.generalSettings.fcmAlarmNotificationEnabled;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.fcmAlarmNotificationEnabled = instance.generalSettings.fcmAlarmNotificationEnabled;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.fcmAlarmNotificationEnabled}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getFcmAlarmNotificationButtons(
                    guildId,
                    instance.generalSettings.fcmAlarmNotificationEnabled,
                    instance.generalSettings.fcmAlarmNotificationEveryone,
                ),
            ],
        });
    } else if (interaction.customId === 'FcmAlarmNotificationEveryone') {
        instance.generalSettings.fcmAlarmNotificationEveryone = !instance.generalSettings.fcmAlarmNotificationEveryone;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.fcmAlarmNotificationEveryone =
                instance.generalSettings.fcmAlarmNotificationEveryone;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.fcmAlarmNotificationEveryone}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getFcmAlarmNotificationButtons(
                    guildId,
                    instance.generalSettings.fcmAlarmNotificationEnabled,
                    instance.generalSettings.fcmAlarmNotificationEveryone,
                ),
            ],
        });
    } else if (interaction.customId === 'SmartAlarmNotifyInGame') {
        instance.generalSettings.smartAlarmNotifyInGame = !instance.generalSettings.smartAlarmNotifyInGame;
        await persistButtonState();

        if (rustplus) rustplus.generalSettings.smartAlarmNotifyInGame = instance.generalSettings.smartAlarmNotifyInGame;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.smartAlarmNotifyInGame}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getSmartAlarmNotifyInGameButton(
                    guildId,
                    instance.generalSettings.smartAlarmNotifyInGame,
                ),
            ],
        });
    } else if (interaction.customId === 'SmartSwitchNotifyInGameWhenChangedFromDiscord') {
        instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord =
            !instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord =
                instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getSmartSwitchNotifyInGameWhenChangedFromDiscordButton(
                    guildId,
                    instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord,
                ),
            ],
        });
    } else if (interaction.customId === 'LeaderCommandEnabled') {
        instance.generalSettings.leaderCommandEnabled = !instance.generalSettings.leaderCommandEnabled;
        await persistButtonState();

        if (rustplus) rustplus.generalSettings.leaderCommandEnabled = instance.generalSettings.leaderCommandEnabled;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.leaderCommandEnabled}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getLeaderCommandEnabledButton(guildId, instance.generalSettings.leaderCommandEnabled),
            ],
        });
    } else if (interaction.customId === 'LeaderCommandOnlyForPaired') {
        instance.generalSettings.leaderCommandOnlyForPaired = !instance.generalSettings.leaderCommandOnlyForPaired;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.leaderCommandOnlyForPaired = instance.generalSettings.leaderCommandOnlyForPaired;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.leaderCommandOnlyForPaired}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getLeaderCommandOnlyForPairedButton(
                    guildId,
                    instance.generalSettings.leaderCommandOnlyForPaired,
                ),
            ],
        });
    } else if (interaction.customId === 'MapWipeNotifyEveryone') {
        instance.generalSettings.mapWipeNotifyEveryone = !instance.generalSettings.mapWipeNotifyEveryone;
        await persistButtonState();

        if (rustplus) rustplus.generalSettings.mapWipeNotifyEveryone = instance.generalSettings.mapWipeNotifyEveryone;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.mapWipeNotifyEveryone}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getMapWipeNotifyEveryoneButton(instance.generalSettings.mapWipeNotifyEveryone)],
        });
    } else if (interaction.customId === 'ItemAvailableNotifyInGame') {
        instance.generalSettings.itemAvailableInVendingMachineNotifyInGame =
            !instance.generalSettings.itemAvailableInVendingMachineNotifyInGame;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.itemAvailableInVendingMachineNotifyInGame =
                instance.generalSettings.itemAvailableInVendingMachineNotifyInGame;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.itemAvailableInVendingMachineNotifyInGame}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getItemAvailableNotifyInGameButton(
                    guildId,
                    instance.generalSettings.itemAvailableInVendingMachineNotifyInGame,
                ),
            ],
        });
    } else if (interaction.customId === 'DisplayInformationBattlemetricsAllOnlinePlayers') {
        instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers =
            !instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.displayInformationBattlemetricsAllOnlinePlayers =
                instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: [
                DiscordButtons.getDisplayInformationBattlemetricsAllOnlinePlayersButton(
                    guildId,
                    instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers,
                ),
            ],
        });
    } else if (interaction.customId === 'BattlemetricsServerNameChanges') {
        instance.generalSettings.battlemetricsServerNameChanges =
            !instance.generalSettings.battlemetricsServerNameChanges;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.battlemetricsServerNameChanges =
                instance.generalSettings.battlemetricsServerNameChanges;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.battlemetricsServerNameChanges}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: await DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId),
        });
    } else if (interaction.customId === 'BattlemetricsTrackerNameChanges') {
        instance.generalSettings.battlemetricsTrackerNameChanges =
            !instance.generalSettings.battlemetricsTrackerNameChanges;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.battlemetricsTrackerNameChanges =
                instance.generalSettings.battlemetricsTrackerNameChanges;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.battlemetricsTrackerNameChanges}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: await DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId),
        });
    } else if (interaction.customId === 'BattlemetricsGlobalNameChanges') {
        instance.generalSettings.battlemetricsGlobalNameChanges =
            !instance.generalSettings.battlemetricsGlobalNameChanges;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.battlemetricsGlobalNameChanges =
                instance.generalSettings.battlemetricsGlobalNameChanges;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.battlemetricsGlobalNameChanges}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: await DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId),
        });
    } else if (interaction.customId === 'BattlemetricsGlobalLogin') {
        instance.generalSettings.battlemetricsGlobalLogin = !instance.generalSettings.battlemetricsGlobalLogin;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.battlemetricsGlobalLogin = instance.generalSettings.battlemetricsGlobalLogin;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.battlemetricsGlobalLogin}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: await DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId),
        });
    } else if (interaction.customId === 'BattlemetricsGlobalLogout') {
        instance.generalSettings.battlemetricsGlobalLogout = !instance.generalSettings.battlemetricsGlobalLogout;
        await persistButtonState();

        if (rustplus)
            rustplus.generalSettings.battlemetricsGlobalLogout = instance.generalSettings.battlemetricsGlobalLogout;

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${instance.generalSettings.battlemetricsGlobalLogout}`,
            }),
        );

        await client.interactionUpdate(interaction, {
            components: await DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId),
        });
    } else if (interaction.customId.startsWith('ServerConnect')) {
        const ids = JSON.parse(interaction.customId.replace('ServerConnect', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        client.resetRustplusVariables(guildId);

        if (instance.activeServer !== null) {
            await DiscordMessages.sendServerMessage(guildId, instance.activeServer, null);
        }

        instance.activeServer = ids.serverId;
        await persistButtonState();

        /* Disconnect previous instance is any */
        if (rustplus) {
            rustplus.isDeleted = true;
            rustplus.disconnect();
        }

        /* Create the rustplus instance */
        const newRustplus = client.createRustplusInstance(
            guildId,
            server.serverIp,
            server.appPort,
            server.steamId,
            server.playerToken,
        );

        await DiscordMessages.sendServerMessage(guildId, ids.serverId, null, interaction);

        newRustplus.isNewConnection = true;
    } else if (interaction.customId.startsWith('ServerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('ServerEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getServerEditModal(guildId, ids.serverId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('DeleteUnreachableDevices')) {
        const ids = JSON.parse(interaction.customId.replace('DeleteUnreachableDevices', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        await interaction.deferUpdate();

        const groupsToUpdate = [];
        for (const [entityId, content] of Object.entries(server.switches) as [string, any][]) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.switches, content.messageId);
                delete server.switches[entityId];

                for (const [groupId, groupContent] of Object.entries(server.switchGroups) as [string, any][]) {
                    if (groupContent.switches.includes(`${entityId}`) && !groupsToUpdate.includes(groupId)) {
                        groupsToUpdate.push(groupId);
                    }
                }
            }
        }

        for (const groupId of groupsToUpdate) {
            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId);
        }

        for (const [entityId, content] of Object.entries(server.alarms) as [string, any][]) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms, content.messageId);
                delete server.alarms[entityId];
            }
        }

        for (const [entityId, content] of Object.entries(server.storageMonitors) as [string, any][]) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors, content.messageId);
                delete server.storageMonitors[entityId];
            }
        }

        await persistButtonState();
    } else if (interaction.customId.startsWith('CustomTimersEdit')) {
        const ids = JSON.parse(interaction.customId.replace('CustomTimersEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getCustomTimersEditModal(guildId, ids.serverId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('CreateTracker')) {
        const ids = JSON.parse(interaction.customId.replace('CreateTracker', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        await interaction.deferUpdate();

        /* Find an available tracker id */
        const trackerId = await client.findAvailableTrackerId(guildId);

        instance.trackers[trackerId] = {
            id: trackerId,
            name: 'Tracker',
            serverId: ids.serverId,
            battlemetricsId: server.battlemetricsId,
            title: server.title,
            img: server.img,
            clanTag: '',
            everyone: false,
            inGame: true,
            players: [],
            messageId: null,
            status: true,
            lastScreenshot: null,
            lastOnline: null,
            lastWipe: null,
        };
        await persistButtonState();

        await DiscordMessages.sendTrackerMessage(guildId, trackerId.toString());
    } else if (interaction.customId.startsWith('CreateGroup')) {
        const ids = JSON.parse(interaction.customId.replace('CreateGroup', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        await interaction.deferUpdate();

        const groupId = await client.findAvailableGroupId(guildId, ids.serverId);

        server.switchGroups[groupId] = {
            id: groupId,
            name: 'Group',
            command: `${groupId}`,
            switches: [],
            image: 'smart_switch.png',
            messageId: null,
            active: false,
            serverId: ids.serverId,
        };
        await persistButtonState();

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${groupId}`,
            }),
        );

        await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId.toString());
    } else if (
        interaction.customId.startsWith('ServerDisconnect') ||
        interaction.customId.startsWith('ServerReconnecting')
    ) {
        const ids = JSON.parse(interaction.customId.replace('ServerDisconnect', '').replace('ServerReconnecting', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }
        instance.activeServer = null;
        await persistButtonState();

        client.resetRustplusVariables(guildId);

        if (rustplus) {
            rustplus.isDeleted = true;
            rustplus.disconnect();
            delete client.rustplusInstances[guildId];
        }

        await DiscordMessages.sendServerMessage(guildId, ids.serverId, null, interaction);
    } else if (interaction.customId.startsWith('ServerDelete')) {
        const ids = JSON.parse(interaction.customId.replace('ServerDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (!(await client.isAdministrator(interaction))) {
            await interaction.deferUpdate();
            return;
        }

        if (!server) {
            await interaction.message.delete();
            return;
        }

        if (rustplus && (rustplus.serverId === ids.serverId || rustplus.serverId === instance.activeServer)) {
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.switches, 100);
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.switchGroups, 100);
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.storageMonitors, 100);

            instance.activeServer = null;
            await persistButtonState();

            client.resetRustplusVariables(guildId);

            rustplus.isDeleted = true;
            rustplus.disconnect();
            delete client.rustplusInstances[guildId];
        }

        for (const [entityId, content] of Object.entries(server.alarms) as [string, any][]) {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms, content.messageId);
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.servers, server.messageId);

        delete instance.serverList[ids.serverId];
        await persistButtonState();
    } else if (interaction.customId.startsWith('SmartSwitchOn') || interaction.customId.startsWith('SmartSwitchOff')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchOn', '').replace('SmartSwitchOff', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.switches, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        if (!rustplus || (rustplus && rustplus.serverId !== ids.serverId)) {
            await interaction.deferUpdate();
            return;
        }

        clearTimeout(rustplus.currentSwitchTimeouts[ids.entityId]);
        delete rustplus.currentSwitchTimeouts[ids.entityId];

        const active = interaction.customId.startsWith('SmartSwitchOn') ? true : false;
        const prevActive = server.switches[ids.entityId].active;
        server.switches[ids.entityId].active = active;
        await persistButtonState();

        rustplus.interactionSwitches.push(ids.entityId);

        const response = await rustplus.turnSmartSwitchAsync(ids.entityId, active);
        if (!rustplus.isResponseValid(response)) {
            if (server.switches[ids.entityId].reachable) {
                await DiscordMessages.sendSmartSwitchNotFoundMessage(guildId, ids.serverId, ids.entityId);
            }
            server.switches[ids.entityId].reachable = false;
            server.switches[ids.entityId].active = prevActive;
            await persistButtonState();

            rustplus.interactionSwitches = rustplus.interactionSwitches.filter((e) => e !== ids.entityId);
        } else {
            server.switches[ids.entityId].reachable = true;
            await persistButtonState();
        }

        if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
            const user = interaction.user.username;
            const name = server.switches[ids.entityId].name;
            const status = DiscordFormattingUtils.getActiveStr(client, guildId, active);
            const str = client.intlGet(guildId, 'userTurnedOnOffSmartSwitchFromDiscord', {
                user: user,
                name: name,
                status: status,
            });

            await rustplus.sendInGameMessage(str);
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${active}`,
            }),
        );

        await DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId, interaction);
        await SmartSwitchGroupHandler.updateSwitchGroupIfContainSwitch(client, guildId, ids.serverId, ids.entityId);
    } else if (interaction.customId.startsWith('SmartSwitchEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.switches, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getSmartSwitchEditModal(guildId, ids.serverId, ids.entityId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('SmartSwitchDelete')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (!(await client.isAdministrator(interaction))) {
            await interaction.deferUpdate();
            return;
        }

        if (!server || (server && !Object.hasOwn(server.switches, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(
            guildId,
            instance.channelId.switches,
            server.switches[ids.entityId].messageId,
        );

        delete server.switches[ids.entityId];
        await persistButtonState();

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.entityId]);
            delete rustplus.currentSwitchTimeouts[ids.entityId];
        }

        for (const [groupId, content] of Object.entries(server.switchGroups) as [string, any][]) {
            if (content.switches.includes(ids.entityId.toString())) {
                server.switchGroups[groupId].switches = content.switches.filter((e) => e !== ids.entityId.toString());
                await persistButtonState();
                await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId);
            }
        }
        await persistButtonState();
    } else if (interaction.customId.startsWith('SmartAlarmEveryone')) {
        const ids = JSON.parse(interaction.customId.replace('SmartAlarmEveryone', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.alarms, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        server.alarms[ids.entityId].everyone = !server.alarms[ids.entityId].everyone;
        await persistButtonState();

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${server.alarms[ids.entityId].everyone}`,
            }),
        );

        await DiscordMessages.sendSmartAlarmMessage(guildId, ids.serverId, ids.entityId, interaction);
    } else if (interaction.customId.startsWith('SmartAlarmDelete')) {
        const ids = JSON.parse(interaction.customId.replace('SmartAlarmDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (!(await client.isAdministrator(interaction))) {
            await interaction.deferUpdate();
            return;
        }

        if (!server || (server && !Object.hasOwn(server.alarms, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms, server.alarms[ids.entityId].messageId);

        delete server.alarms[ids.entityId];
        await persistButtonState();
    } else if (interaction.customId.startsWith('SmartAlarmEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartAlarmEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.alarms, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getSmartAlarmEditModal(guildId, ids.serverId, ids.entityId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('StorageMonitorToolCupboardEveryone')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorToolCupboardEveryone', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.storageMonitors, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        server.storageMonitors[ids.entityId].everyone = !server.storageMonitors[ids.entityId].everyone;
        await persistButtonState();

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${server.storageMonitors[ids.entityId].everyone}`,
            }),
        );

        await DiscordMessages.sendStorageMonitorMessage(guildId, ids.serverId, ids.entityId, interaction);
    } else if (interaction.customId.startsWith('StorageMonitorToolCupboardInGame')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorToolCupboardInGame', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.storageMonitors, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        server.storageMonitors[ids.entityId].inGame = !server.storageMonitors[ids.entityId].inGame;
        await persistButtonState();

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${server.storageMonitors[ids.entityId].inGame}`,
            }),
        );

        await DiscordMessages.sendStorageMonitorMessage(guildId, ids.serverId, ids.entityId, interaction);
    } else if (interaction.customId.startsWith('StorageMonitorEdit')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.storageMonitors, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getStorageMonitorEditModal(guildId, ids.serverId, ids.entityId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('StorageMonitorToolCupboardDelete')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorToolCupboardDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (!(await client.isAdministrator(interaction))) {
            await interaction.deferUpdate();
            return;
        }

        if (!server || (server && !Object.hasOwn(server.storageMonitors, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(
            guildId,
            instance.channelId.storageMonitors,
            server.storageMonitors[ids.entityId].messageId,
        );

        delete server.storageMonitors[ids.entityId];
        await persistButtonState();
    } else if (interaction.customId.startsWith('StorageMonitorRecycle')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorRecycle', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.storageMonitors, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await interaction.deferUpdate();

        if (!rustplus || (rustplus && rustplus.serverId !== ids.serverId)) return;

        const entityInfo = await rustplus.getEntityInfoAsync(ids.entityId);
        if (!rustplus.isResponseValid(entityInfo)) {
            if (server.storageMonitors[ids.entityId].reachable) {
                await DiscordMessages.sendStorageMonitorNotFoundMessage(guildId, ids.serverId, ids.entityId);
            }
            server.storageMonitors[ids.entityId].reachable = false;
            await persistButtonState();

            await DiscordMessages.sendStorageMonitorMessage(guildId, ids.serverId, ids.entityId);
            return;
        }

        server.storageMonitors[ids.entityId].reachable = true;
        await persistButtonState();

        const items = client.rustlabs.getRecycleDataFromArray(entityInfo.entityInfo.payload.items);

        const message = await DiscordMessages.sendStorageMonitorRecycleMessage(
            guildId,
            ids.serverId,
            ids.entityId,
            items,
        );

        setTimeout(async () => {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors, message.id);
        }, 30000);
    } else if (interaction.customId.startsWith('StorageMonitorContainerDelete')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorContainerDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (!(await client.isAdministrator(interaction))) {
            await interaction.deferUpdate();
            return;
        }

        if (!server || (server && !Object.hasOwn(server.storageMonitors, ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(
            guildId,
            instance.channelId.storageMonitors,
            server.storageMonitors[ids.entityId].messageId,
        );

        delete server.storageMonitors[ids.entityId];
        await persistButtonState();
    } else if (interaction.customId === 'RecycleDelete') {
        if (!(await client.isAdministrator(interaction))) {
            await interaction.deferUpdate();
            return;
        }

        await interaction.message.delete();
    } else if (interaction.customId.startsWith('GroupTurnOn') || interaction.customId.startsWith('GroupTurnOff')) {
        const ids = JSON.parse(interaction.customId.replace('GroupTurnOn', '').replace('GroupTurnOff', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.switchGroups, ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        await interaction.deferUpdate();

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.group]);
            delete rustplus.currentSwitchTimeouts[ids.group];

            if (rustplus.serverId === ids.serverId) {
                const active = interaction.customId.startsWith('GroupTurnOn') ? true : false;

                if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
                    const user = interaction.user.username;
                    const name = server.switchGroups[ids.groupId].name;
                    const status = DiscordFormattingUtils.getActiveStr(client, guildId, active);
                    const str = client.intlGet(guildId, 'userTurnedOnOffSmartSwitchGroupFromDiscord', {
                        user: user,
                        name: name,
                        status: status,
                    });

                    await rustplus.sendInGameMessage(str);
                }

                client.log(
                    client.intlGet(null, 'infoCap'),
                    client.intlGet(null, 'buttonValueChange', {
                        id: `${verifyId}`,
                        value: `${active}`,
                    }),
                );

                await SmartSwitchGroupHandler.TurnOnOffGroup(
                    client,
                    rustplus,
                    guildId,
                    ids.serverId,
                    ids.groupId,
                    active,
                );
            }
        }
    } else if (interaction.customId.startsWith('GroupEdit')) {
        const ids = JSON.parse(interaction.customId.replace('GroupEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.switchGroups, ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupEditModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('GroupDelete')) {
        const ids = JSON.parse(interaction.customId.replace('GroupDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (!(await client.isAdministrator(interaction))) {
            await interaction.deferUpdate();
            return;
        }

        if (!server || (server && !Object.hasOwn(server.switchGroups, ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.groupId]);
            delete rustplus.currentSwitchTimeouts[ids.groupId];
        }

        if (Object.hasOwn(server.switchGroups, ids.groupId)) {
            await DiscordTools.deleteMessageById(
                guildId,
                instance.channelId.switchGroups,
                server.switchGroups[ids.groupId].messageId,
            );

            delete server.switchGroups[ids.groupId];
            await persistButtonState();
        }
    } else if (interaction.customId.startsWith('GroupAddSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupAddSwitch', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.switchGroups, ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupAddSwitchModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('GroupRemoveSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupRemoveSwitch', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !Object.hasOwn(server.switchGroups, ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupRemoveSwitchModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('TrackerEveryone')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerEveryone', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        tracker.everyone = !tracker.everyone;
        await persistButtonState();

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${tracker.everyone}`,
            }),
        );

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, interaction);
    } else if (interaction.customId.startsWith('TrackerUpdate')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerUpdate', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        // TODO! Remove name change icon from status

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, interaction);
    } else if (interaction.customId.startsWith('TrackerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerEdit', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerEditModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('TrackerDelete')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerDelete', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!(await client.isAdministrator(interaction))) {
            await interaction.deferUpdate();
            return;
        }

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.trackers, tracker.messageId);

        delete instance.trackers[ids.trackerId];
        await persistButtonState();
    } else if (interaction.customId.startsWith('TrackerAddPlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerAddPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerAddPlayerModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('TrackerRemovePlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerRemovePlayer', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerRemovePlayerModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    } else if (interaction.customId.startsWith('TrackerInGame')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerInGame', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        tracker.inGame = !tracker.inGame;
        await persistButtonState();

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${tracker.inGame}`,
            }),
        );

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, interaction);
    }

    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, 'userButtonInteractionSuccess', {
            id: `${verifyId}`,
        }),
    );
};
