import * as DiscordModule from 'discord.js';

const Discord: any = DiscordModule;

import PushReceiverClient from '@liamcottle/push-receiver/src/client.js';

import Battlemetrics from '../structures/Battlemetrics.js';
import * as ConstantsModule from '../util/constants.js';

const Constants: any = ConstantsModule;

import * as DiscordEmbedsModule from '../discordTools/discordEmbeds.js';

const DiscordEmbeds: any = DiscordEmbedsModule;

import * as DiscordMessagesModule from '../discordTools/discordMessages.js';

const DiscordMessages: any = DiscordMessagesModule;

import * as DiscordToolsModule from '../discordTools/discordTools.js';

const DiscordTools: any = DiscordToolsModule;

import * as InstanceUtilsModule from '../util/instanceUtils.js';

const InstanceUtils: any = InstanceUtilsModule;

import * as GameMapModule from './GameMap.js';

const GameMap: any = GameMapModule;

import * as ScrapeModule from '../util/scrape.js';

const Scrape: any = ScrapeModule;

import { cwdPath } from '../utils/filesystemUtils.js';

/**
 * Start an FCM push listener for a guild member.
 * When steamId is omitted (or null) the listener runs in host mode and handles
 * the full feature set. When steamId is provided the listener runs in lite mode
 * for that specific guild member (credentials stored in serverListLite only).
 */
export default async (client: any, guild: any, steamId: string | null = null) => {
    const isLite = steamId !== null;
    const logPrefix = isLite ? 'FCM Lite' : 'FCM Host';

    const credentials = InstanceUtils.readCredentialsFile(guild.id);
    const hoster = credentials.hoster;

    if (isLite) {
        if (!Object.keys(credentials).includes(steamId)) {
            client.log(
                client.intlGet(null, 'warningCap'),
                client.intlGet(null, 'credentialsNotRegistered', { steamId: steamId }),
            );
            return;
        }

        if (steamId === hoster) {
            client.log(
                client.intlGet(null, 'warningCap'),
                client.intlGet(null, 'credentialsCannotStartLiteAlreadyHoster', { steamId: steamId }),
            );
            return;
        }
    } else {
        if (Object.keys(credentials).length === 1) {
            client.log(
                client.intlGet(null, 'warningCap'),
                client.intlGet(null, 'credentialsNotRegisteredForGuild', { id: guild.id }),
            );
            return;
        }

        if (!hoster) {
            client.log(
                client.intlGet(null, 'warningCap'),
                client.intlGet(guild.id, 'credentialsHosterNotSetForGuild', { id: guild.id }),
            );
            return;
        }
    }

    const activeSteamId = isLite ? steamId : hoster;

    /* Destroy previous listener instance(s) */
    if (isLite) {
        if (client.fcmListenersLite[guild.id][steamId]) {
            client.fcmListenersLite[guild.id][steamId].destroy();
            delete client.fcmListenersLite[guild.id][steamId];
        }
    } else {
        if (client.fcmListeners[guild.id]) client.fcmListeners[guild.id].destroy();
        if (client.fcmListenersLite[guild.id][hoster]) {
            client.fcmListenersLite[guild.id][hoster].destroy();
            delete client.fcmListenersLite[guild.id][hoster];
        }
    }

    client.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, isLite ? 'fcmListenerStartLite' : 'fcmListenerStartHost', {
            guildId: guild.id,
            steamId: activeSteamId,
        }),
    );

    const discordUserId = credentials[activeSteamId].discord_user_id;

    const androidId = credentials[activeSteamId].gcm.android_id;
    const securityToken = credentials[activeSteamId].gcm.security_token;

    const listener = new PushReceiverClient(androidId, securityToken, []);

    if (isLite) {
        client.fcmListenersLite[guild.id][steamId] = listener;
    } else {
        client.fcmListeners[guild.id] = listener;
    }

    listener.on('ON_DATA_RECEIVED', (data: any) => {
        const appData = data.appData;

        if (!appData) {
            client.log(logPrefix, `GuildID: ${guild.id}, SteamID: ${activeSteamId}, appData could not be found.`);
            return;
        }

        const title = appData.find((item: any) => item.key === 'title')?.value;
        const message = appData.find((item: any) => item.key === 'message')?.value;
        const channelId = appData.find((item: any) => item.key === 'channelId')?.value;

        if (!channelId) {
            client.log(logPrefix, `GuildID: ${guild.id}, SteamID: ${activeSteamId}, channelId could not be found.`);
            return;
        }

        const bodyCheck = appData.find((item: any) => item.key === 'body');

        if (!bodyCheck) {
            client.log(logPrefix, `GuildID: ${guild.id}, SteamID: ${activeSteamId}, body could not be found.`);
            return;
        }

        const body = JSON.parse(bodyCheck.value);

        if (!body.type) {
            client.log(logPrefix, `GuildID: ${guild.id}, SteamID: ${activeSteamId}, body type could not be found.`);
            return;
        }

        switch (channelId) {
            case 'pairing':
                {
                    switch (body.type) {
                        case 'server':
                            {
                                client.log(
                                    logPrefix,
                                    `GuildID: ${guild.id}, SteamID: ${activeSteamId}, pairing: server`,
                                );
                                pairingServer(client, guild, title, message, body, isLite, activeSteamId);
                            }
                            break;

                        case 'entity':
                            {
                                switch (body.entityName) {
                                    case 'Smart Switch':
                                        {
                                            client.log(
                                                logPrefix,
                                                `GuildID: ${guild.id}, SteamID: ${activeSteamId}, pairing: entity: Switch`,
                                            );
                                            pairingEntitySwitch(client, guild, body, body.playerId);
                                        }
                                        break;

                                    case 'Smart Alarm':
                                        {
                                            client.log(
                                                logPrefix,
                                                `GuildID: ${guild.id}, SteamID: ${activeSteamId}, pairing: entity: Smart Alarm`,
                                            );
                                            pairingEntitySmartAlarm(client, guild, body, body.playerId);
                                        }
                                        break;

                                    case 'Storage Monitor':
                                        {
                                            client.log(
                                                logPrefix,
                                                `GuildID: ${guild.id}, SteamID: ${activeSteamId}, pairing: entity: Storage Monitor`,
                                            );
                                            pairingEntityStorageMonitor(client, guild, body, body.playerId);
                                        }
                                        break;

                                    default:
                                        {
                                            client.log(
                                                logPrefix,
                                                `GuildID: ${guild.id}, SteamID: ${activeSteamId}, ` +
                                                    `pairing: entity: other\n${JSON.stringify(data)}`,
                                            );
                                        }
                                        break;
                                }
                            }
                            break;

                        default:
                            {
                                if (!isLite) {
                                    client.log(
                                        logPrefix,
                                        `GuildID: ${guild.id}, SteamID: ${activeSteamId}, pairing: other\n${JSON.stringify(data)}`,
                                    );
                                }
                            }
                            break;
                    }
                }
                break;

            case 'alarm':
                {
                    switch (body.type) {
                        case 'alarm':
                            {
                                client.log(logPrefix, `GuildID: ${guild.id}, SteamID: ${activeSteamId}, alarm: alarm`);
                                alarmAlarm(client, guild, title, message, body);
                            }
                            break;

                        default:
                            {
                                if (title === "You're getting raided!") {
                                    /* Custom alarm from plugin: https://umod.org/plugins/raid-alarm */
                                    client.log(
                                        logPrefix,
                                        `GuildID: ${guild.id}, SteamID: ${activeSteamId}, alarm: raid-alarm plugin`,
                                    );
                                    alarmRaidAlarm(client, guild, title, message, body);
                                    break;
                                }
                                client.log(
                                    logPrefix,
                                    `GuildID: ${guild.id}, SteamID: ${activeSteamId}, alarm: other\n${JSON.stringify(data)}`,
                                );
                            }
                            break;
                    }
                }
                break;

            case 'player':
                {
                    switch (body.type) {
                        case 'death':
                            {
                                client.log(logPrefix, `GuildID: ${guild.id}, SteamID: ${activeSteamId}, player: death`);
                                playerDeath(client, guild, title, message, body, discordUserId);
                            }
                            break;

                        default:
                            {
                                if (!isLite) {
                                    client.log(
                                        logPrefix,
                                        `GuildID: ${guild.id}, SteamID: ${activeSteamId}, player: other\n${JSON.stringify(data)}`,
                                    );
                                }
                            }
                            break;
                    }
                }
                break;

            case 'team':
                {
                    switch (body.type) {
                        case 'login':
                            {
                                client.log(logPrefix, `GuildID: ${guild.id}, SteamID: ${activeSteamId}, team: login`);
                                teamLogin(client, guild, title, message, body);
                            }
                            break;

                        default:
                            {
                                if (!isLite) {
                                    client.log(
                                        logPrefix,
                                        `GuildID: ${guild.id}, SteamID: ${activeSteamId}, team: other\n${JSON.stringify(data)}`,
                                    );
                                }
                            }
                            break;
                    }
                }
                break;

            //case 'news': {
            //    switch (body.type) {
            //        case 'news': {
            //            client.log(logPrefix, `GuildID: ${guild.id}, SteamID: ${activeSteamId}, news: news`);
            //            newsNews(client, guild, full, data, body);
            //        } break;

            //        default: {
            //            client.log(logPrefix,
            //                `GuildID: ${guild.id}, SteamID: ${activeSteamId}, news: other\n${JSON.stringify(full)}`);
            //        } break;
            //    }
            //} break;

            default:
                {
                    if (!isLite) {
                        client.log(
                            logPrefix,
                            `GuildID: ${guild.id}, SteamID: ${activeSteamId}, other\n${JSON.stringify(data)}`,
                        );
                    }
                }
                break;
        }
    });

    listener.connect();
};

function isValidUrl(url: string): boolean {
    return url.startsWith('https') || url.startsWith('http');
}

async function pairingServer(
    client: any,
    guild: any,
    title: any,
    message: any,
    body: any,
    isLite: boolean,
    activeSteamId: any,
) {
    const instance = client.getInstance(guild.id);
    const serverId = `${body.ip}-${body.port}`;

    if (isLite) {
        if (!Object.hasOwn(instance.serverListLite, serverId)) {
            instance.serverListLite[serverId] = {};
        }

        instance.serverListLite[serverId][activeSteamId] = {
            serverIp: body.ip,
            appPort: body.port,
            steamId: body.playerId,
            playerToken: body.playerToken,
        };
        client.setInstance(guild.id, instance);

        const rustplus = client.rustplusInstances[guild.id];
        if (rustplus && rustplus.serverId === serverId && rustplus.team.leaderSteamId === activeSteamId) {
            rustplus.updateLeaderRustPlusLiteInstance();
        }
    } else {
        const server = instance.serverList[serverId];

        let messageObj = undefined;
        if (server)
            messageObj = await DiscordTools.getMessageById(guild.id, instance.channelId.servers, server.messageId);

        let battlemetricsId = null;
        const bmInstance = new Battlemetrics(null, title);
        await bmInstance.setup();
        if (bmInstance.lastUpdateSuccessful) {
            battlemetricsId = bmInstance.id;
            if (!Object.hasOwn(client.battlemetricsInstances, bmInstance.id)) {
                client.battlemetricsInstances[bmInstance.id] = bmInstance;
            }
        }

        instance.serverList[serverId] = {
            title: title,
            serverIp: body.ip,
            appPort: body.port,
            steamId: body.playerId,
            playerToken: body.playerToken,
            description: body.desc.replace(/\\n/g, '\n').replace(/\\t/g, '\t'),
            img: isValidUrl(body.img) ? body.img.replace(/ /g, '%20') : Constants.DEFAULT_SERVER_IMG,
            url: isValidUrl(body.url) ? body.url.replace(/ /g, '%20') : Constants.DEFAULT_SERVER_URL,
            notes: server ? server.notes : {},
            switches: server ? server.switches : {},
            alarms: server ? server.alarms : {},
            storageMonitors: server ? server.storageMonitors : {},
            markers: server ? server.markers : {},
            switchGroups: server ? server.switchGroups : {},
            messageId: messageObj !== undefined ? messageObj.id : null,
            battlemetricsId: battlemetricsId,
            connect: !bmInstance.lastUpdateSuccessful
                ? null
                : `connect ${bmInstance.server_ip}:${bmInstance.server_port}`,
            cargoShipEgressTimeMs: server ? server.cargoShipEgressTimeMs : Constants.DEFAULT_CARGO_SHIP_EGRESS_TIME_MS,
            oilRigLockedCrateUnlockTimeMs: server
                ? server.oilRigLockedCrateUnlockTimeMs
                : Constants.DEFAULT_OIL_RIG_LOCKED_CRATE_UNLOCK_TIME_MS,
            deepSeaMinWipeCooldownMs: server
                ? server.deepSeaMinWipeCooldownMs
                : Constants.DEFAULT_DEEP_SEA_MIN_WIPE_COOLDOWN_MS,
            deepSeaMaxWipeCooldownMs: server
                ? server.deepSeaMaxWipeCooldownMs
                : Constants.DEFAULT_DEEP_SEA_MAX_WIPE_COOLDOWN_MS,
            deepSeaWipeDurationMs: server ? server.deepSeaWipeDurationMs : Constants.DEFAULT_DEEP_SEA_WIPE_DURATION_MS,
            timeTillDay: server ? server.timeTillDay : null,
            timeTillNight: server ? server.timeTillNight : null,
        };

        if (!Object.hasOwn(instance.serverListLite, serverId)) {
            instance.serverListLite[serverId] = {};
        }

        instance.serverListLite[serverId][body.playerId] = {
            serverIp: body.ip,
            appPort: body.port,
            steamId: body.playerId,
            playerToken: body.playerToken,
        };

        client.setInstance(guild.id, instance);

        await DiscordMessages.sendServerMessage(guild.id, serverId, null);
    }
}

async function pairingEntitySwitch(client: any, guild: any, body: any, pairingPlayerId: any) {
    const instance = client.getInstance(guild.id);
    const serverId = `${body.ip}-${body.port}`;
    if (!Object.hasOwn(instance.serverList, serverId)) return;

    const switches = instance.serverList[serverId].switches;
    const entityExist = Object.hasOwn(switches, body.entityId);
    instance.serverList[serverId].switches[body.entityId] = {
        active: entityExist ? switches[body.entityId].active : false,
        reachable: entityExist ? switches[body.entityId].reachable : true,
        name: entityExist ? switches[body.entityId].name : client.intlGet(guild.id, 'smartSwitch'),
        command: entityExist ? switches[body.entityId].command : body.entityId,
        image: entityExist ? switches[body.entityId].image : 'smart_switch.png',
        autoDayNightOnOff: entityExist ? switches[body.entityId].autoDayNightOnOff : 0,
        location: entityExist ? switches[body.entityId].location : null,
        x: entityExist ? switches[body.entityId].x : null,
        y: entityExist ? switches[body.entityId].y : null,
        server: entityExist ? switches[body.entityId].server : body.name,
        proximity: entityExist ? switches[body.entityId].proximity : Constants.PROXIMITY_SETTING_DEFAULT_METERS,
        messageId: entityExist ? switches[body.entityId].messageId : null,
    };
    client.setInstance(guild.id, instance);

    const rustplus = client.rustplusInstances[guild.id];
    if (rustplus && serverId === rustplus.serverId) {
        const info = await rustplus.getEntityInfoAsync(body.entityId);
        if (!rustplus.isResponseValid(info)) {
            instance.serverList[serverId].switches[body.entityId].reachable = false;
        }

        const teamInfo = await rustplus.getTeamInfoAsync();
        if (rustplus.isResponseValid(teamInfo)) {
            const player = teamInfo.teamInfo.members.find((e: any) => e.steamId.toString() === pairingPlayerId);
            if (player) {
                const location = GameMap.getPos(player.x, player.y, rustplus.info.correctedMapSize, rustplus);
                instance.serverList[serverId].switches[body.entityId].location = location.location;
                instance.serverList[serverId].switches[body.entityId].x = location.x;
                instance.serverList[serverId].switches[body.entityId].y = location.y;
            }
        }

        if (instance.serverList[serverId].switches[body.entityId].reachable) {
            instance.serverList[serverId].switches[body.entityId].active = info.entityInfo.payload.value;
        }
        client.setInstance(guild.id, instance);

        await DiscordMessages.sendSmartSwitchMessage(guild.id, serverId, body.entityId);
    }
}

async function pairingEntitySmartAlarm(client: any, guild: any, body: any, pairingPlayerId: any) {
    const instance = client.getInstance(guild.id);
    const serverId = `${body.ip}-${body.port}`;
    if (!Object.hasOwn(instance.serverList, serverId)) return;

    const alarms = instance.serverList[serverId].alarms;
    const entityExist = Object.hasOwn(alarms, body.entityId);
    instance.serverList[serverId].alarms[body.entityId] = {
        active: entityExist ? alarms[body.entityId].active : false,
        reachable: entityExist ? alarms[body.entityId].reachable : true,
        everyone: entityExist ? alarms[body.entityId].everyone : false,
        name: entityExist ? alarms[body.entityId].name : client.intlGet(guild.id, 'smartAlarm'),
        message: entityExist ? alarms[body.entityId].message : client.intlGet(guild.id, 'baseIsUnderAttack'),
        lastTrigger: entityExist ? alarms[body.entityId].lastTrigger : null,
        command: entityExist ? alarms[body.entityId].command : body.entityId,
        id: entityExist ? alarms[body.entityId].id : body.entityId,
        image: entityExist ? alarms[body.entityId].image : 'smart_alarm.png',
        location: entityExist ? alarms[body.entityId].location : null,
        server: entityExist ? alarms[body.entityId].server : body.name,
        messageId: entityExist ? alarms[body.entityId].messageId : null,
    };
    client.setInstance(guild.id, instance);

    const rustplus = client.rustplusInstances[guild.id];
    if (rustplus && serverId === rustplus.serverId) {
        const info = await rustplus.getEntityInfoAsync(body.entityId);
        if (!rustplus.isResponseValid(info)) {
            instance.serverList[serverId].alarms[body.entityId].reachable = false;
        }

        const teamInfo = await rustplus.getTeamInfoAsync();
        if (rustplus.isResponseValid(teamInfo)) {
            const player = teamInfo.teamInfo.members.find((e: any) => e.steamId.toString() === pairingPlayerId);
            if (player) {
                const location = GameMap.getPos(player.x, player.y, rustplus.info.correctedMapSize, rustplus);
                instance.serverList[serverId].alarms[body.entityId].location = location.location;
            }
        }

        if (instance.serverList[serverId].alarms[body.entityId].reachable) {
            instance.serverList[serverId].alarms[body.entityId].active = info.entityInfo.payload.value;
        }
        client.setInstance(guild.id, instance);
    }

    await DiscordMessages.sendSmartAlarmMessage(guild.id, serverId, body.entityId);
}

async function pairingEntityStorageMonitor(client: any, guild: any, body: any, pairingPlayerId: any) {
    const instance = client.getInstance(guild.id);
    const serverId = `${body.ip}-${body.port}`;
    if (!Object.hasOwn(instance.serverList, serverId)) return;

    const storageMonitors = instance.serverList[serverId].storageMonitors;
    const entityExist = Object.hasOwn(storageMonitors, body.entityId);
    instance.serverList[serverId].storageMonitors[body.entityId] = {
        name: entityExist ? storageMonitors[body.entityId].name : client.intlGet(guild.id, 'storageMonitor'),
        reachable: entityExist ? storageMonitors[body.entityId].reachable : true,
        id: entityExist ? storageMonitors[body.entityId].id : body.entityId,
        type: entityExist ? storageMonitors[body.entityId].type : null,
        decaying: entityExist ? storageMonitors[body.entityId].decaying : false,
        upkeep: entityExist ? storageMonitors[body.entityId].upkeep : null,
        everyone: entityExist ? storageMonitors[body.entityId].everyone : false,
        inGame: entityExist ? storageMonitors[body.entityId].inGame : true,
        image: entityExist ? storageMonitors[body.entityId].image : 'storage_monitor.png',
        location: entityExist ? storageMonitors[body.entityId].location : null,
        server: entityExist ? storageMonitors[body.entityId].server : body.name,
        messageId: entityExist ? storageMonitors[body.entityId].messageId : null,
    };
    client.setInstance(guild.id, instance);

    const rustplus = client.rustplusInstances[guild.id];
    if (rustplus && serverId === rustplus.serverId) {
        const info = await rustplus.getEntityInfoAsync(body.entityId);
        if (!rustplus.isResponseValid(info)) {
            instance.serverList[serverId].storageMonitors[body.entityId].reachable = false;
        }

        const teamInfo = await rustplus.getTeamInfoAsync();
        if (rustplus.isResponseValid(teamInfo)) {
            const player = teamInfo.teamInfo.members.find((e: any) => e.steamId.toString() === pairingPlayerId);
            if (player) {
                const location = GameMap.getPos(player.x, player.y, rustplus.info.correctedMapSize, rustplus);
                instance.serverList[serverId].storageMonitors[body.entityId].location = location.location;
            }
        }

        if (instance.serverList[serverId].storageMonitors[body.entityId].reachable) {
            if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY) {
                instance.serverList[serverId].storageMonitors[body.entityId].type = 'toolCupboard';
                instance.serverList[serverId].storageMonitors[body.entityId].image = 'tool_cupboard.png';
                if (info.entityInfo.payload.protectionExpiry === 0) {
                    instance.serverList[serverId].storageMonitors[body.entityId].decaying = true;
                }
            } else if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_VENDING_MACHINE_CAPACITY) {
                instance.serverList[serverId].storageMonitors[body.entityId].type = 'vendingMachine';
                instance.serverList[serverId].storageMonitors[body.entityId].image = 'vending_machine.png';
            } else if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_LARGE_WOOD_BOX_CAPACITY) {
                instance.serverList[serverId].storageMonitors[body.entityId].type = 'largeWoodBox';
                instance.serverList[serverId].storageMonitors[body.entityId].image = 'large_wood_box.png';
            }

            rustplus.storageMonitors[body.entityId] = {
                items: info.entityInfo.payload.items,
                expiry: info.entityInfo.payload.protectionExpiry,
                capacity: info.entityInfo.payload.capacity,
                hasProtection: info.entityInfo.payload.hasProtection,
            };
        }
        client.setInstance(guild.id, instance);

        await DiscordMessages.sendStorageMonitorMessage(guild.id, serverId, body.entityId);
    }
}

async function alarmAlarm(client: any, guild: any, title: any, message: any, body: any) {
    /* Unfortunately the alarm notification from the fcm listener is unreliable. The notification does not include
    which entityId that got triggered which makes it impossible to know which Smart Alarms are still being used
    actively. Also, from testing it seems that notifications don't always reach this fcm listener which makes it even
    more unreliable. The only advantage to using the fcm listener alarm notification is that it includes the title and
    description messagethat is configured on the Smart Alarm in the game. Due to missing out on this data, Smart Alarm
    title and description message needs to be re-configured via the /alarm slash command. Alarms that are used on the
    connected rust server will be handled through the message event from rustplus. Smart Alarms that are still attached
    to the credential owner and which is not part of the currently connected rust server can notify IF the general
    setting fcmAlarmNotificationEnabled is enabled. Those notifications will be handled here. */

    const instance = client.getInstance(guild.id);
    const serverId = `${body.ip}-${body.port}`;
    const entityId = body.entityId;
    const server = instance.serverList[serverId];
    const rustplus = client.rustplusInstances[guild.id];

    if (!server || !server.alarms[entityId]) return;

    if ((!rustplus || rustplus.serverId !== serverId) && instance.generalSettings.fcmAlarmNotificationEnabled) {
        server.alarms[entityId].lastTrigger = Math.floor(Date.now() / 1000);
        client.setInstance(guild.id, instance);
        await DiscordMessages.sendSmartAlarmTriggerMessage(guild.id, serverId, entityId);
        client.log(client.intlGet(null, 'infoCap'), `${title}: ${message}`);
    }
}

async function alarmRaidAlarm(client: any, guild: any, title: any, message: any, body: any) {
    const instance = client.getInstance(guild.id);
    const serverId = `${body.ip}-${body.port}`;
    const rustplus = client.rustplusInstances[guild.id];

    if (!Object.hasOwn(instance.serverList, serverId)) return;

    const files = [];
    if (body.img === '') {
        files.push(new Discord.AttachmentBuilder(cwdPath('resources/images/rocket.png')));
    }

    const content = {
        embeds: [DiscordEmbeds.getAlarmRaidAlarmEmbed({ title: title, message: message }, body)],
        content: '@everyone',
        files: files,
    };

    if (rustplus && serverId === rustplus.serverId) {
        await DiscordMessages.sendMessage(guild.id, content, null, instance.channelId.activity);
        rustplus.sendInGameMessage(`${title}: ${message}`);
    }

    client.log(client.intlGet(null, 'infoCap'), `${title} ${message}`);
}

async function playerDeath(client: any, guild: any, title: any, message: any, body: any, discordUserId: any) {
    const user = await DiscordTools.getUserById(guild.id, discordUserId);
    if (!user) return;

    let png = null;
    if (body.targetId !== '') png = await Scrape.scrapeSteamProfilePicture(client, body.targetId);
    if (png === null) png = isValidUrl(body.img) ? body.img : Constants.DEFAULT_SERVER_IMG;

    await client.messageSend(user, {
        embeds: [DiscordEmbeds.getPlayerDeathEmbed({ title: title }, body, png)],
    });
}

async function teamLogin(client: any, guild: any, title: any, message: any, body: any) {
    const instance = client.getInstance(guild.id);
    const rustplus = client.rustplusInstances[guild.id];
    const serverId = `${body.ip}-${body.port}`;

    if (!rustplus || rustplus.serverId !== serverId) {
        await DiscordMessages.sendMessage(
            guild.id,
            {
                embeds: [
                    DiscordEmbeds.getTeamLoginEmbed(
                        guild.id,
                        body,
                        await Scrape.scrapeSteamProfilePicture(client, body.targetId),
                    ),
                ],
            },
            null,
            instance.channelId.activity,
        );
        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'playerJustConnectedTo', {
                name: body.targetName,
                server: body.name,
            }),
        );
    }
}

//async function newsNews(client, guild, full, data, body) {
//    const instance = client.getInstance(guild.id);
//
//    const content = {
//        embeds: [DiscordEmbeds.getNewsEmbed(guild.id, data)],
//        components: [DiscordButtons.getNewsButton(guild.id, body, isValidUrl(body.url))]
//    }
//
//    await DiscordMessages.sendMessage(guild.id, content, null, instance.channelId.activity);
//}
