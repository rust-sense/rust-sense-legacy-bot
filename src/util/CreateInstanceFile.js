const fs = require('node:fs');
const path = require('node:path');

const InstanceUtils = require('../util/instanceUtils');
const Constants = require('./constants');

module.exports = (client, guild) => {
    let instance = null;
    if (!fs.existsSync(path.join(__dirname, '..', '..', 'instances', `${guild.id}.json`))) {
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
    } else {
        instance = InstanceUtils.readInstanceFile(guild.id);

        if (!Object.hasOwn(instance, 'firstTime')) {
            instance.firstTime = true;
        }

        if (!Object.hasOwn(instance, 'role')) {
            instance.role = null;
        }

        if (!Object.hasOwn(instance, 'adminRole')) {
            instance.adminRole = null;
        }

        if (!Object.hasOwn(instance, 'generalSettings')) {
            instance.generalSettings = client.readGeneralSettingsTemplate();
        } else {
            const generalSettings = client.readGeneralSettingsTemplate();

            for (const [key, value] of Object.entries(generalSettings)) {
                if (!Object.hasOwn(instance.generalSettings, key)) {
                    instance.generalSettings[key] = value;
                }
            }
        }

        if (!Object.hasOwn(instance, 'notificationSettings')) {
            instance.notificationSettings = client.readNotificationSettingsTemplate();
        } else {
            const notificationSettings = client.readNotificationSettingsTemplate();

            for (const [key, value] of Object.entries(notificationSettings)) {
                if (!Object.hasOwn(instance.notificationSettings, key)) {
                    instance.notificationSettings[key] = value;
                } else {
                    for (const [setting, settingValue] of Object.entries(value)) {
                        if (!instance.notificationSettings[key].hasOwnProperty(setting)) {
                            instance.notificationSettings[key][setting] = settingValue;
                        }
                    }
                }
            }
        }

        if (!Object.hasOwn(instance, 'channelId')) {
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
            if (!Object.hasOwn(instance.channelId, 'category')) instance.channelId.category = null;
            if (!Object.hasOwn(instance.channelId, 'information')) instance.channelId.information = null;
            if (!Object.hasOwn(instance.channelId, 'servers')) instance.channelId.servers = null;
            if (!Object.hasOwn(instance.channelId, 'settings')) instance.channelId.settings = null;
            if (!Object.hasOwn(instance.channelId, 'commands')) instance.channelId.commands = null;
            if (!Object.hasOwn(instance.channelId, 'events')) instance.channelId.events = null;
            if (!Object.hasOwn(instance.channelId, 'teamchat')) instance.channelId.teamchat = null;
            if (!Object.hasOwn(instance.channelId, 'switches')) instance.channelId.switches = null;
            if (!Object.hasOwn(instance.channelId, 'switchGroups')) instance.channelId.switchGroups = null;
            if (!Object.hasOwn(instance.channelId, 'alarms')) instance.channelId.alarms = null;
            if (!Object.hasOwn(instance.channelId, 'storageMonitors')) instance.channelId.storageMonitors = null;
            if (!Object.hasOwn(instance.channelId, 'activity')) instance.channelId.activity = null;
            if (!Object.hasOwn(instance.channelId, 'trackers')) instance.channelId.trackers = null;
        }

        if (!Object.hasOwn(instance, 'informationMessageId')) {
            instance.informationMessageId = {
                map: null,
                server: null,
                event: null,
                team: null,
                battlemetricsPlayers: null,
            };
        } else {
            if (!Object.hasOwn(instance.informationMessageId, 'map')) instance.informationMessageId.map = null;
            if (!Object.hasOwn(instance.informationMessageId, 'server')) instance.informationMessageId.server = null;
            if (!Object.hasOwn(instance.informationMessageId, 'event')) instance.informationMessageId.event = null;
            if (!Object.hasOwn(instance.informationMessageId, 'team')) instance.informationMessageId.team = null;
            if (!Object.hasOwn(instance.informationMessageId, 'team'))
                instance.informationMessageId.battlemetricsPlayers = null;
        }

        if (!Object.hasOwn(instance, 'activeServer')) instance.activeServer = null;
        if (!Object.hasOwn(instance, 'serverList')) instance.serverList = {};
        if (!Object.hasOwn(instance, 'serverListLite')) instance.serverListLite = {};
        if (!Object.hasOwn(instance, 'trackers')) instance.trackers = {};
        if (!Object.hasOwn(instance, 'marketSubscriptionList'))
            instance.marketSubscriptionList = {
                all: [],
                buy: [],
                sell: [],
            };
        if (!Object.hasOwn(instance, 'marketBlacklist')) instance.marketBlacklist = [];
        if (!Object.hasOwn(instance.marketSubscriptionList, 'all')) instance.marketSubscriptionList['all'] = [];
        if (!Object.hasOwn(instance.marketSubscriptionList, 'buy')) instance.marketSubscriptionList['buy'] = [];
        if (!Object.hasOwn(instance.marketSubscriptionList, 'sell')) instance.marketSubscriptionList['sell'] = [];
        if (!Object.hasOwn(instance, 'teamChatColors')) instance.teamChatColors = {};
        if (!Object.hasOwn(instance, 'blacklist'))
            instance.blacklist = {
                discordIds: [],
                steamIds: [],
            };
        if (!Object.hasOwn(instance.blacklist, 'discordIds')) instance.blacklist['discordIds'] = [];
        if (!Object.hasOwn(instance.blacklist, 'steamIds')) instance.blacklist['steamIds'] = [];
        if (!Object.hasOwn(instance, 'whitelist'))
            instance.whitelist = {
                steamIds: [],
            };
        if (!Object.hasOwn(instance.whitelist, 'steamIds')) instance.whitelist['steamIds'] = [];
        if (!Object.hasOwn(instance, 'aliases')) instance.aliases = [];
        if (!Object.hasOwn(instance, 'customIntlMessages')) instance.customIntlMessages = {};

        for (const serverId of Object.keys(instance.serverList)) {
            if (!Object.keys(instance.serverListLite).includes(serverId)) {
                instance.serverListLite[serverId] = new Object();
            }

            instance.serverListLite[serverId][instance.serverList[serverId].steamId] = {
                serverIp: instance.serverList[serverId].serverIp,
                appPort: instance.serverList[serverId].appPort,
                steamId: instance.serverList[serverId].steamId,
                playerToken: instance.serverList[serverId].playerToken,
            };
        }
    }

    /* Check every serverList for missing keys */
    for (const [serverId, content] of Object.entries(instance.serverList)) {
        if (!Object.hasOwn(content, 'customCameraGroups')) content.customCameraGroups = {};
        if (!Object.hasOwn(content, 'cargoShipEgressTimeMs')) {
            content.cargoShipEgressTimeMs = Constants.DEFAULT_CARGO_SHIP_EGRESS_TIME_MS;
        }
        if (!Object.hasOwn(content, 'oilRigLockedCrateUnlockTimeMs')) {
            content.oilRigLockedCrateUnlockTimeMs = Constants.DEFAULT_OIL_RIG_LOCKED_CRATE_UNLOCK_TIME_MS;
        }
        if (!Object.hasOwn(content, 'deepSeaMinWipeCooldownMs')) {
            content.deepSeaMinWipeCooldownMs = Constants.DEFAULT_DEEP_SEA_MIN_WIPE_COOLDOWN_MS;
        }
        if (!Object.hasOwn(content, 'deepSeaMaxWipeCooldownMs')) {
            content.deepSeaMaxWipeCooldownMs = Constants.DEFAULT_DEEP_SEA_MAX_WIPE_COOLDOWN_MS;
        }
        if (!Object.hasOwn(content, 'deepSeaWipeDurationMs')) {
            content.deepSeaWipeDurationMs = Constants.DEFAULT_DEEP_SEA_WIPE_DURATION_MS;
        }
    }

    client.setInstance(guild.id, instance);
};
