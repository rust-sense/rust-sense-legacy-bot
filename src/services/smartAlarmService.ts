import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as Timer from '../domain/timer.js';
import { getPersistenceCache } from '../persistence/index.js';
import type DiscordBot from '../structures/DiscordBot.js';

export async function syncSmartAlarms(rustplus: any, client: DiscordBot) {
    let instance = await getPersistenceCache().readGuildState(rustplus.guildId);
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;

    if (!Object.hasOwn(instance.serverList, serverId)) {
        return;
    }

    if (rustplus.smartAlarmIntervalCounter === 29) {
        rustplus.smartAlarmIntervalCounter = 0;
    } else {
        rustplus.smartAlarmIntervalCounter += 1;
    }

    if (rustplus.smartAlarmIntervalCounter === 0) {
        for (const entityId in instance.serverList[serverId].alarms) {
            instance = await getPersistenceCache().readGuildState(guildId);

            const info = await rustplus.getEntityInfoAsync(entityId);
            if (!rustplus.isResponseValid(info)) {
                if (instance.serverList[serverId].alarms[entityId].reachable) {
                    await DiscordMessages.sendSmartAlarmNotFoundMessage(guildId, serverId, entityId);

                    instance.serverList[serverId].alarms[entityId].reachable = false;
                    await getPersistenceCache().updateSmartAlarmFields(guildId, serverId, entityId, {
                        reachable: false,
                    });

                    await DiscordMessages.sendSmartAlarmMessage(guildId, serverId, entityId);
                }
            } else {
                if (!instance.serverList[serverId].alarms[entityId].reachable) {
                    instance.serverList[serverId].alarms[entityId].reachable = true;
                    await getPersistenceCache().updateSmartAlarmFields(guildId, serverId, entityId, {
                        reachable: true,
                    });

                    await DiscordMessages.sendSmartAlarmMessage(guildId, serverId, entityId);
                }
            }
        }
    }
}

export async function smartAlarmCommandHandler(rustplus: any, client: DiscordBot, command: string) {
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;
    const instance = await getPersistenceCache().readGuildState(guildId);
    const alarms = instance.serverList[serverId].alarms;
    const prefix = rustplus.generalSettings.prefix;

    const entityId = Object.keys(alarms).find((e) => command === `${prefix}${alarms[e].command}`);
    if (!entityId) return false;

    if (alarms[entityId].lastTrigger === null) {
        rustplus.sendInGameMessage(
            client.intlGet(guildId, 'alarmHaveNotBeenTriggeredYet', {
                alarm: alarms[entityId].name,
            }),
        );
        return true;
    }

    const lastTriggerDate = new Date(alarms[entityId].lastTrigger * 1000);
    const timeSinceTriggerSeconds = Math.floor((new Date().getTime() - lastTriggerDate.getTime()) / 1000);
    const time = Timer.secondsToFullScale(timeSinceTriggerSeconds);

    rustplus.sendInGameMessage(
        client.intlGet(guildId, 'timeSinceAlarmWasTriggered', {
            alarm: alarms[entityId].name,
            time: time,
        }),
    );
    return true;
}
