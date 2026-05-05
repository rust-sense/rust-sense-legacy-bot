import type { Instance, NotificationSettings, Server } from '../types/instance.js';
import { buildDefaultGeneralSettings, buildDefaultNotificationSettings } from './guildSettings.js';

export function createEmptyInstance(
    generalSettings: Instance['generalSettings'] = buildDefaultGeneralSettings(),
    notificationSettings: NotificationSettings = buildDefaultNotificationSettings(),
): Instance {
    return {
        firstTime: true,
        role: null,
        adminRole: null,
        generalSettings,
        notificationSettings,
        channelId: {
            category: null,
            information: null,
            servers: null,
            settings: null,
            commands: null,
            events: null,
            teamchat: null,
            switches: null,
            switchGroups: null,
            alarms: null,
            storageMonitors: null,
            activity: null,
            trackers: null,
        },
        informationMessageId: {
            map: null,
            server: null,
            event: null,
            team: null,
            battlemetricsPlayers: null,
        },
        activeServer: null,
        serverList: {},
        serverListLite: {},
        trackers: {},
        marketSubscriptionList: {
            all: [],
            buy: [],
            sell: [],
        },
        marketBlacklist: [],
        teamChatColors: {},
        blacklist: {
            discordIds: [],
            steamIds: [],
        },
        whitelist: {
            steamIds: [],
        },
        aliases: [],
        customIntlMessages: {},
    };
}

export function addServerLite(instance: Instance, server: Server): void {
    if (!(server.serverId in instance.serverListLite)) {
        instance.serverListLite[server.serverId] = {};
    }

    instance.serverListLite[server.serverId][server.steamId] = {
        serverIp: server.serverIp,
        appPort: server.appPort,
        steamId: server.steamId,
        playerToken: server.playerToken,
    };
}
