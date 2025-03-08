const CommandHandler = require('../handlers/inGameCommandHandler');
const Constants = require('../util/constants');
const DiscordMessages = require('../discordTools/discordMessages');
const InGameChatHandler = require('../handlers/inGameChatHandler');
const SmartSwitchGroupHandler = require('../handlers/smartSwitchGroupHandler');
const TeamChatHandler = require('../handlers/teamChatHandler');
const TeamHandler = require('../handlers/teamHandler');

export default {
    name: 'message',
    async execute(rustplus, client, message) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        if (!rustplus.isOperational) return;

        if (Object.hasOwn(message, 'response')) {
            messageResponse(rustplus, client, message);
        } else if (Object.hasOwn(message, 'broadcast')) {
            messageBroadcast(rustplus, client, message);
        }
    },
};

async function messageResponse(rustplus, client, message) {
    /* Not implemented */
}

async function messageBroadcast(rustplus, client, message) {
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

async function messageBroadcastTeamChanged(rustplus, client, message) {
    TeamHandler.handler(rustplus, client, message.broadcast.teamChanged.teamInfo);
    const changed = rustplus.team.isLeaderSteamIdChanged(message.broadcast.teamChanged.teamInfo);
    rustplus.team.updateTeam(message.broadcast.teamChanged.teamInfo);
    if (changed) rustplus.updateLeaderRustPlusLiteInstance();
}

async function messageBroadcastTeamMessage(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const steamId = message.broadcast.teamMessage.message.steamId.toString();

    if (steamId === rustplus.playerId) {
        /* Delay inGameChatHandler */
        clearTimeout(rustplus.inGameChatTimeout);
        const commandDelayMs = Number.parseInt(rustplus.generalSettings.commandDelay) * 1000;
        rustplus.inGameChatTimeout = setTimeout(InGameChatHandler.inGameChatHandler, commandDelayMs, rustplus, client);
    }

    let tempName = message.broadcast.teamMessage.message.name;
    let tempMessage = message.broadcast.teamMessage.message.message;

    tempName = tempName.replace(/^<size=.*?><color=.*?>/, ''); /* Rustafied */
    tempName = tempName.replace(/<\/color><\/size>$/, ''); /* Rustafied */
    message.broadcast.teamMessage.message.name = tempName;

    tempMessage = tempMessage.replace(/^<size=.*?><color=.*?>/, ''); /* Rustafied */
    tempMessage = tempMessage.replace(/<\/color><\/size>$/, ''); /* Rustafied */
    tempMessage = tempMessage.replace(/^<color.+?<\/color>/g, ''); /* Unknown */
    message.broadcast.teamMessage.message.message = tempMessage;

    if (instance.blacklist['steamIds'].includes(`${steamId}`)) {
        rustplus.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, `userPartOfBlacklistInGame`, {
                user: `${message.broadcast.teamMessage.message.name} (${steamId})`,
                message: message.broadcast.teamMessage.message.message,
            }),
        );
        TeamChatHandler(rustplus, client, message.broadcast.teamMessage.message);
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

    const isCommand = await CommandHandler.inGameCommandHandler(rustplus, client, message);
    if (isCommand) return;

    rustplus.log(
        client.intlGet(null, 'infoCap'),
        client.intlGet(null, `logInGameMessage`, {
            message: message.broadcast.teamMessage.message.message,
            user: `${message.broadcast.teamMessage.message.name} (${steamId})`,
        }),
    );

    TeamChatHandler(rustplus, client, message.broadcast.teamMessage.message);
}

async function messageBroadcastEntityChanged(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const entityId = message.broadcast.entityChanged.entityId;

    if (instance.serverList[rustplus.serverId].Object.hasOwn(switches, entityId)) {
        messageBroadcastEntityChangedSmartSwitch(rustplus, client, message);
    } else if (instance.serverList[rustplus.serverId].Object.hasOwn(alarms, entityId)) {
        messageBroadcastEntityChangedSmartAlarm(rustplus, client, message);
    } else if (instance.serverList[rustplus.serverId].Object.hasOwn(storageMonitors, entityId)) {
        messageBroadcastEntityChangedStorageMonitor(rustplus, client, message);
    }
}

async function messageBroadcastCameraRays(rustplus, client, message) {
    /* Not implemented */
}

async function messageBroadcastEntityChangedSmartSwitch(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.switches[entityId])) return;

    if (rustplus.interactionSwitches.includes(`${entityId}`)) {
        rustplus.interactionSwitches = rustplus.interactionSwitches.filter((e) => e !== `${entityId}`);
        return;
    }

    if (Object.hasOwn(rustplus.currentSwitchTimeouts, entityId)) {
        clearTimeout(rustplus.currentSwitchTimeouts[entityId]);
        delete rustplus.currentSwitchTimeouts[entityId];
    }

    const active = message.broadcast.entityChanged.payload.value;
    server.switches[entityId].active = active;
    client.setInstance(rustplus.guildId, instance);

    DiscordMessages.sendSmartSwitchMessage(rustplus.guildId, serverId, entityId);
    SmartSwitchGroupHandler.updateSwitchGroupIfContainSwitch(client, rustplus.guildId, serverId, entityId);
}

async function messageBroadcastEntityChangedSmartAlarm(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.alarms[entityId])) return;

    const active = message.broadcast.entityChanged.payload.value;
    server.alarms[entityId].active = active;
    server.alarms[entityId].reachable = true;
    client.setInstance(rustplus.guildId, instance);

    if (active) {
        server.alarms[entityId].lastTrigger = Math.floor(new Date() / 1000);
        client.setInstance(rustplus.guildId, instance);
        await DiscordMessages.sendSmartAlarmTriggerMessage(rustplus.guildId, serverId, entityId);

        if (instance.generalSettings.smartAlarmNotifyInGame) {
            rustplus.sendInGameMessage(`${server.alarms[entityId].name}: ${server.alarms[entityId].message}`);
        }
    }

    DiscordMessages.sendSmartAlarmMessage(rustplus.guildId, rustplus.serverId, entityId);
}

async function messageBroadcastEntityChangedStorageMonitor(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
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
        client.setInstance(rustplus.guildId, instance);

        await DiscordMessages.sendStorageMonitorMessage(rustplus.guildId, serverId, entityId);
    }
}

async function updateToolCupboard(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const server = instance.serverList[rustplus.serverId];
    const entityId = message.broadcast.entityChanged.entityId;

    const info = await rustplus.getEntityInfoAsync(entityId);
    server.storageMonitors[entityId].reachable = rustplus.isResponseValid(info) ? true : false;
    client.setInstance(rustplus.guildId, instance);

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
        client.setInstance(rustplus.guildId, instance);
    }

    await DiscordMessages.sendStorageMonitorMessage(rustplus.guildId, rustplus.serverId, entityId);
}
