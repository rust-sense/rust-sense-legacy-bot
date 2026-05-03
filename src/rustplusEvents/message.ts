import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as Constants from '../domain/constants.js';
import { getPersistenceCache } from '../persistence/index.js';
import * as TeamHandler from '../services/teamService.js';

export default {
    name: 'message',
    execute(rustplus: any, client: any, message: any) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        if (!rustplus.isOperational) return;

        if (Object.hasOwn(message, 'response')) {
            messageResponse(rustplus, client, message);
        } else if (Object.hasOwn(message, 'broadcast')) {
            messageBroadcast(rustplus, client, message);
        }
    },
};
function messageResponse(rustplus: any, client: any, message: any) {
    /* Not implemented */
}
function messageBroadcast(rustplus: any, client: any, message: any) {
    if (Object.hasOwn(message.broadcast, 'teamChanged')) {
        messageBroadcastTeamChanged(rustplus, client, message);
    } else if (Object.hasOwn(message.broadcast, 'teamMessage')) {
        messageBroadcastTeamMessage(rustplus, client, message);
    } else if (Object.hasOwn(message.broadcast, 'entityChanged')) {
        messageBroadcastEntityChanged(rustplus, client, message);
    } else if (Object.hasOwn(message.broadcast, 'cameraRays')) {
        messageBroadcastCameraRays(rustplus, client, message);
    }
}
function messageBroadcastTeamChanged(rustplus: any, client: any, message: any) {
    TeamHandler.processTeamUpdate(rustplus, client, message.broadcast.teamChanged.teamInfo);
    const changed = rustplus.team.isLeaderSteamIdChanged(message.broadcast.teamChanged.teamInfo);
    rustplus.team.updateTeam(message.broadcast.teamChanged.teamInfo);
    if (changed) rustplus.updateLeaderRustPlusLiteInstance();
}

async function messageBroadcastTeamMessage(rustplus: any, client: any, message: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);
    const steamId = message.broadcast.teamMessage.message.steamId.toString();

    if (steamId === rustplus.playerId) {
        /* Delay inGameChatHandler */
        clearTimeout(rustplus.inGameChatTimeout);
        const commandDelayMs = Number.parseInt(rustplus.generalSettings.commandDelay) * 1000;
        const InGameChatHandler = await import('../services/inGameChatService.js');
        rustplus.inGameChatTimeout = setTimeout(InGameChatHandler.inGameChatHandler, commandDelayMs, rustplus, client);
    }

    let tempName = message.broadcast.teamMessage.message.name;
    let tempMessage = message.broadcast.teamMessage.message.message;

    tempName = tempName.replace(/^\u003csize=.*?\u003e\u003ccolor=.*?\u003e/, ''); /* Rustafied */
    tempName = tempName.replace(/\u003c\/color\u003e\u003c\/size\u003e$/, ''); /* Rustafied */
    message.broadcast.teamMessage.message.name = tempName;

    tempMessage = tempMessage.replace(/^\u003csize=.*?\u003e\u003ccolor=.*?\u003e/, ''); /* Rustafied */
    tempMessage = tempMessage.replace(/\u003c\/color\u003e\u003c\/size\u003e$/, ''); /* Rustafied */
    tempMessage = tempMessage.replace(/^\u003ccolor.+?\u003c\/color\u003e/g, ''); /* Unknown */
    message.broadcast.teamMessage.message.message = tempMessage;

    const inGameCommandAccessMode = getInGameCommandAccessMode(rustplus);
    if (steamId !== rustplus.playerId && shouldIgnoreInGameCommand(instance, steamId, inGameCommandAccessMode)) {
        const strId =
            inGameCommandAccessMode === 'whitelist' ? 'userNotPartOfWhitelistInGame' : 'userPartOfBlacklistInGame';
        rustplus.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, strId, {
                user: `${message.broadcast.teamMessage.message.name} (${steamId})`,
                message: message.broadcast.teamMessage.message.message,
            }),
            'info',
        );
        const TeamChatHandler = await import('../services/teamChatService.js');
        TeamChatHandler.default(rustplus, client, message.broadcast.teamMessage.message);
        return;
    }

    if (rustplus.messagesSentByBot.includes(message.broadcast.teamMessage.message.message)) {
        /* Remove message from messagesSendByBot */
        for (let i = rustplus.messagesSentByBot.length - 1; i >= 0; i--) {
            if (rustplus.messagesSentByBot[i] === message.broadcast.teamMessage.message.message) {
                rustplus.messagesSentByBot.splice(i, 1);
            }
        }
        return;
    }

    const CommandHandler = await import('../services/inGameCommandService.js');
    const isCommand = await CommandHandler.inGameCommandHandler(rustplus, client, message);
    if (isCommand) return;

    rustplus.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, `logInGameMessage`, {
            message: message.broadcast.teamMessage.message.message,
            user: `${message.broadcast.teamMessage.message.name} (${steamId})`,
        }),
        'info',
    );

    const TeamChatHandler = await import('../services/teamChatService.js');
    TeamChatHandler.default(rustplus, client, message.broadcast.teamMessage.message);
}

async function messageBroadcastEntityChanged(rustplus: any, client: any, message: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);
    const entityId = message.broadcast.entityChanged.entityId;

    if (Object.hasOwn(instance.serverList[rustplus.serverId].switches, entityId)) {
        messageBroadcastEntityChangedSmartSwitch(rustplus, client, message);
    } else if (Object.hasOwn(instance.serverList[rustplus.serverId].alarms, entityId)) {
        messageBroadcastEntityChangedSmartAlarm(rustplus, client, message);
    } else if (Object.hasOwn(instance.serverList[rustplus.serverId].storageMonitors, entityId)) {
        messageBroadcastEntityChangedStorageMonitor(rustplus, client, message);
    }
}
function messageBroadcastCameraRays(rustplus: any, client: any, message: any) {
    /* Not implemented */
}

async function messageBroadcastEntityChangedSmartSwitch(rustplus: any, client: any, message: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.switches[entityId])) return;

    if (rustplus.interactionSwitches.includes(`${entityId}`)) {
        rustplus.interactionSwitches = rustplus.interactionSwitches.filter((e: string) => e !== `${entityId}`);
        return;
    }

    if (Object.hasOwn(rustplus.currentSwitchTimeouts, entityId)) {
        clearTimeout(rustplus.currentSwitchTimeouts[entityId]);
        delete rustplus.currentSwitchTimeouts[entityId];
    }

    const active = message.broadcast.entityChanged.payload.value;
    server.switches[entityId].active = active;
    await getPersistenceCache().saveGuildStateChanges(rustplus.guildId, instance);

    DiscordMessages.sendSmartSwitchMessage(rustplus.guildId, serverId, entityId);
    const SmartSwitchGroupHandler = await import('../services/smartSwitchGroupService.js');
    SmartSwitchGroupHandler.updateSwitchGroupIfContainSwitch(client, rustplus.guildId, serverId, entityId);
}

async function messageBroadcastEntityChangedSmartAlarm(rustplus: any, client: any, message: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.alarms[entityId])) return;

    const active = message.broadcast.entityChanged.payload.value;
    server.alarms[entityId].active = active;
    server.alarms[entityId].reachable = true;
    await getPersistenceCache().saveGuildStateChanges(rustplus.guildId, instance);

    if (active) {
        server.alarms[entityId].lastTrigger = Math.floor(Date.now() / 1000);
        await getPersistenceCache().saveGuildStateChanges(rustplus.guildId, instance);
        await DiscordMessages.sendSmartAlarmTriggerMessage(rustplus.guildId, serverId, entityId);

        if (instance.generalSettings.smartAlarmNotifyInGame) {
            rustplus.sendInGameMessage(`${server.alarms[entityId].name}: ${server.alarms[entityId].message}`);
        }
    }

    DiscordMessages.sendSmartAlarmMessage(rustplus.guildId, rustplus.serverId, entityId);
}

async function messageBroadcastEntityChangedStorageMonitor(rustplus: any, client: any, message: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.storageMonitors[entityId])) return;

    if (message.broadcast.entityChanged.payload.value === true) return;

    if (
        server.storageMonitors[entityId].type === 'toolCupboard' ||
        message.broadcast.entityChanged.payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY
    ) {
        setTimeout(updateToolCupboard.bind(null, rustplus, client, message), 2000);
    } else {
        rustplus.storageMonitors[entityId] = {
            items: message.broadcast.entityChanged.payload.items,
            expiry: message.broadcast.entityChanged.payload.protectionExpiry,
            capacity: message.broadcast.entityChanged.payload.capacity,
            hasProtection: message.broadcast.entityChanged.payload.hasProtection,
        };

        const info = await rustplus.getEntityInfoAsync(entityId);
        server.storageMonitors[entityId].reachable = rustplus.isResponseValid(info) ? true : false;

        if (server.storageMonitors[entityId].reachable) {
            if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_VENDING_MACHINE_CAPACITY) {
                server.storageMonitors[entityId].type = 'vendingMachine';
            } else if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_LARGE_WOOD_BOX_CAPACITY) {
                server.storageMonitors[entityId].type = 'largeWoodBox';
            }
        }
        await getPersistenceCache().saveGuildStateChanges(rustplus.guildId, instance);

        await DiscordMessages.sendStorageMonitorMessage(rustplus.guildId, serverId, entityId);
    }
}

async function updateToolCupboard(rustplus: any, client: any, message: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);
    const server = instance.serverList[rustplus.serverId];
    const entityId = message.broadcast.entityChanged.entityId;

    const info = await rustplus.getEntityInfoAsync(entityId);
    server.storageMonitors[entityId].reachable = rustplus.isResponseValid(info) ? true : false;
    await getPersistenceCache().saveGuildStateChanges(rustplus.guildId, instance);

    if (server.storageMonitors[entityId].reachable) {
        rustplus.storageMonitors[entityId] = {
            items: info.entityInfo.payload.items,
            expiry: info.entityInfo.payload.protectionExpiry,
            capacity: info.entityInfo.payload.capacity,
            hasProtection: info.entityInfo.payload.hasProtection,
        };

        server.storageMonitors[entityId].type = 'toolCupboard';

        if (info.entityInfo.payload.protectionExpiry === 0 && server.storageMonitors[entityId].decaying === false) {
            server.storageMonitors[entityId].decaying = true;

            await DiscordMessages.sendDecayingNotificationMessage(rustplus.guildId, rustplus.serverId, entityId);

            if (server.storageMonitors[entityId].inGame) {
                rustplus.sendInGameMessage(
                    client.intlGet(rustplus.guildId, 'isDecaying', {
                        device: server.storageMonitors[entityId].name,
                    }),
                );
            }
        } else if (info.entityInfo.payload.protectionExpiry !== 0) {
            server.storageMonitors[entityId].decaying = false;
        }
        await getPersistenceCache().saveGuildStateChanges(rustplus.guildId, instance);
    }

    await DiscordMessages.sendStorageMonitorMessage(rustplus.guildId, rustplus.serverId, entityId);
}

function getInGameCommandAccessMode(rustplus: any) {
    const mode = `${rustplus.generalSettings.inGameCommandAccessMode || 'blacklist'}`.toLowerCase();
    return mode === 'whitelist' ? 'whitelist' : 'blacklist';
}

function shouldIgnoreInGameCommand(instance: any, steamId: string, inGameCommandAccessMode: string) {
    const steamIdStr = `${steamId}`;
    const blacklistSteamIds =
        instance.blacklist && Array.isArray(instance.blacklist['steamIds']) ? instance.blacklist['steamIds'] : [];

    if (inGameCommandAccessMode === 'whitelist') {
        const whitelistSteamIds =
            instance.whitelist && Array.isArray(instance.whitelist['steamIds']) ? instance.whitelist['steamIds'] : [];
        return !whitelistSteamIds.includes(steamIdStr);
    }

    return blacklistSteamIds.includes(steamIdStr);
}
