import Fs from 'fs';

import Path from 'path';
import InstanceUtils from '../util/instanceUtils.js';

export type GuildInstance = {
    firstTime: true,
    role: null,
    adminRole: null,
    generalSettings: client.readGeneralSettingsTemplate(),
    notificationSettings: client.readNotificationSettingsTemplate(),
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
    teamChatColors: {},
    blacklist: {
        discordIds: [],
        steamIds: [],
    },
    aliases: [],
    customIntlMessages: {}
};

export default (client, guild) => {
    let instance = null;
    if (!Fs.existsSync(Path.join(__dirname, '..', '..', 'instances', `${guild.id}.json`))) {
        // @ts-expect-error TS(2322) FIXME: Type '{ firstTime: boolean; role: null; adminRole:... Remove this comment to see the full error message
        instance = {
            firstTime: true,
            role: null,
            adminRole: null,
            generalSettings: client.readGeneralSettingsTemplate(),
            notificationSettings: client.readNotificationSettingsTemplate(),
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
            teamChatColors: {},
            blacklist: {
                discordIds: [],
                steamIds: [],
            },
            aliases: [],
            customIntlMessages: {},
        };
    } else {
        instance = InstanceUtils.readInstanceFile(guild.id);

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('firstTime')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.firstTime = true;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('role')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.role = null;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('adminRole')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.adminRole = null;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('generalSettings')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.generalSettings = client.readGeneralSettingsTemplate();
        } else {
            const generalSettings = client.readGeneralSettingsTemplate();

            for (const [key, value] of Object.entries(generalSettings)) {
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                if (!instance.generalSettings.hasOwn(key)) {
                    // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                    instance.generalSettings[key] = value;
                }
            }
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('notificationSettings')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.notificationSettings = client.readNotificationSettingsTemplate();
        } else {
            const notificationSettings = client.readNotificationSettingsTemplate();

            for (const [key, value] of Object.entries(notificationSettings)) {
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                if (!instance.notificationSettings.hasOwn(key)) {
                    // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                    instance.notificationSettings[key] = value;
                } else {
                    // @ts-expect-error TS(2769) FIXME: No overload matches this call.
                    for (const [setting, settingValue] of Object.entries(value)) {
                        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                        if (!instance.notificationSettings[key].hasOwn(setting)) {
                            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                            instance.notificationSettings[key][setting] = settingValue;
                        }
                    }
                }
            }
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('channelId')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.channelId = {
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
            };
        } else {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('category')) instance.channelId.category = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('information')) instance.channelId.information = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('servers')) instance.channelId.servers = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('settings')) instance.channelId.settings = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('commands')) instance.channelId.commands = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('events')) instance.channelId.events = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('teamchat')) instance.channelId.teamchat = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('switches')) instance.channelId.switches = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('switchGroups')) instance.channelId.switchGroups = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('alarms')) instance.channelId.alarms = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('storageMonitors')) instance.channelId.storageMonitors = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('activity')) instance.channelId.activity = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwn('trackers')) instance.channelId.trackers = null;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('informationMessageId')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.informationMessageId = {
                map: null,
                server: null,
                event: null,
                team: null,
                battlemetricsPlayers: null,
            };
        } else {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwn('map')) instance.informationMessageId.map = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwn('server')) instance.informationMessageId.server = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwn('event')) instance.informationMessageId.event = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwn('team')) instance.informationMessageId.team = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwn('team'))
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                instance.informationMessageId.battlemetricsPlayers = null;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('activeServer')) instance.activeServer = null;
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('serverList')) instance.serverList = {};
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('serverListLite')) instance.serverListLite = {};
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('trackers')) instance.trackers = {};
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('marketSubscriptionList'))
            instance.marketSubscriptionList = {
                all: [],
                buy: [],
                sell: [],
            };
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.marketSubscriptionList.hasOwn('all')) instance.marketSubscriptionList['all'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.marketSubscriptionList.hasOwn('buy')) instance.marketSubscriptionList['buy'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.marketSubscriptionList.hasOwn('sell')) instance.marketSubscriptionList['sell'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('teamChatColors')) instance.teamChatColors = {};
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('blacklist'))
            instance.blacklist = {
                discordIds: [],
                steamIds: [],
            };
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.blacklist.hasOwn('discordIds')) instance.blacklist['discordIds'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.blacklist.hasOwn('steamIds')) instance.blacklist['steamIds'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('aliases')) instance.aliases = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwn('customIntlMessages')) instance.customIntlMessages = {};

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        for (const serverId of Object.keys(instance.serverList)) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!Object.keys(instance.serverListLite).includes(serverId)) {
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                instance.serverListLite[serverId] = new Object();
            }

            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.serverListLite[serverId][instance.serverList[serverId].steamId] = {
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                serverIp: instance.serverList[serverId].serverIp,
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                appPort: instance.serverList[serverId].appPort,
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                steamId: instance.serverList[serverId].steamId,
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                playerToken: instance.serverList[serverId].playerToken,
            };
        }
    }

    /* Check every serverList for missing keys */
    // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
    for (const [serverId, content] of Object.entries(instance.serverList)) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (!content.hasOwn('customCameraGroups')) content.customCameraGroups = {};
    }

    client.setInstance(guild.id, instance);
};
