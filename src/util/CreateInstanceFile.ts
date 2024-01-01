/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

import Fs from 'fs';

import Path from 'path';
import InstanceUtils from '../util/instanceUtils.js';

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
                trackers: null
            },
            informationMessageId: {
                map: null,
                server: null,
                event: null,
                team: null,
                battlemetricsPlayers: null
            },
            activeServer: null,
            serverList: {},
            serverListLite: {},
            trackers: {},
            marketSubscriptionList: {
                all: [],
                buy: [],
                sell: []
            },
            teamChatColors: {},
            blacklist: {
                discordIds: [],
                steamIds: []
            },
            aliases: [],
            customIntlMessages: {}
        };
    }
    else {
        instance = InstanceUtils.readInstanceFile(guild.id);

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('firstTime')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.firstTime = true;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('role')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.role = null;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('adminRole')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.adminRole = null;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('generalSettings')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.generalSettings = client.readGeneralSettingsTemplate();
        }
        else {
            const generalSettings = client.readGeneralSettingsTemplate();

            for (const [key, value] of Object.entries(generalSettings)) {
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                if (!instance.generalSettings.hasOwnProperty(key)) {
                    // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                    instance.generalSettings[key] = value;
                }
            }
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('notificationSettings')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.notificationSettings = client.readNotificationSettingsTemplate();
        }
        else {
            const notificationSettings = client.readNotificationSettingsTemplate();

            for (const [key, value] of Object.entries(notificationSettings)) {
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                if (!instance.notificationSettings.hasOwnProperty(key)) {
                    // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                    instance.notificationSettings[key] = value;
                }
                else {
                    // @ts-expect-error TS(2769) FIXME: No overload matches this call.
                    for (const [setting, settingValue] of Object.entries(value)) {
                        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                        if (!instance.notificationSettings[key].hasOwnProperty(setting)) {
                            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                            instance.notificationSettings[key][setting] = settingValue;
                        }
                    }
                }
            }
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('channelId')) {
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
                trackers: null
            }
        }
        else {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('category')) instance.channelId.category = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('information')) instance.channelId.information = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('servers')) instance.channelId.servers = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('settings')) instance.channelId.settings = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('commands')) instance.channelId.commands = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('events')) instance.channelId.events = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('teamchat')) instance.channelId.teamchat = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('switches')) instance.channelId.switches = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('switchGroups')) instance.channelId.switchGroups = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('alarms')) instance.channelId.alarms = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('storageMonitors')) instance.channelId.storageMonitors = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('activity')) instance.channelId.activity = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.channelId.hasOwnProperty('trackers')) instance.channelId.trackers = null;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('informationMessageId')) {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            instance.informationMessageId = {
                map: null,
                server: null,
                event: null,
                team: null,
                battlemetricsPlayers: null
            }
        }
        else {
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwnProperty('map')) instance.informationMessageId.map = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwnProperty('server')) instance.informationMessageId.server = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwnProperty('event')) instance.informationMessageId.event = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwnProperty('team')) instance.informationMessageId.team = null;
            // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
            if (!instance.informationMessageId.hasOwnProperty('team'))
                // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
                instance.informationMessageId.battlemetricsPlayers = null;
        }

        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('activeServer')) instance.activeServer = null;
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('serverList')) instance.serverList = {};
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('serverListLite')) instance.serverListLite = {};
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('trackers')) instance.trackers = {};
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('marketSubscriptionList')) instance.marketSubscriptionList = {
            all: [],
            buy: [],
            sell: []
        }
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.marketSubscriptionList.hasOwnProperty('all')) instance.marketSubscriptionList['all'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.marketSubscriptionList.hasOwnProperty('buy')) instance.marketSubscriptionList['buy'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.marketSubscriptionList.hasOwnProperty('sell')) instance.marketSubscriptionList['sell'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('teamChatColors')) instance.teamChatColors = {};
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('blacklist')) instance.blacklist = {
            discordIds: [],
            steamIds: []
        }
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.blacklist.hasOwnProperty('discordIds')) instance.blacklist['discordIds'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.blacklist.hasOwnProperty('steamIds')) instance.blacklist['steamIds'] = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('aliases')) instance.aliases = [];
        // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
        if (!instance.hasOwnProperty('customIntlMessages')) instance.customIntlMessages = {};

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
                playerToken: instance.serverList[serverId].playerToken
            };
        }
    }

    /* Check every serverList for missing keys */
    // @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
    for (const [serverId, content] of Object.entries(instance.serverList)) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (!content.hasOwnProperty('customCameraGroups')) content.customCameraGroups = {};
    }

    client.setInstance(guild.id, instance);
};
