import _ from 'lodash';
import { getPersistenceCache } from '../persistence/index.js';
import type DiscordBot from '../structures/DiscordBot.js';

export function syncRustPlusTime(rustplus: any, client: DiscordBot, time: any) {
    /* Check time changes */
    checkChanges(rustplus, client, time);
}

export async function checkChanges(rustplus: any, client: DiscordBot, time: any) {
    if (rustplus.time.timeTillActive) return;

    const prevTime = rustplus.time.time;
    const newTime = time.time;

    if (rustplus.isFirstPoll) {
        rustplus.time.startTime = newTime;
        rustplus.startTimeObject[newTime] = 0;
        return;
    }

    const distance = prevTime > newTime ? 24 - prevTime + newTime : newTime - prevTime;
    if (distance > 1) {
        /* Too big of a jump for a normal server, might have been a skip night server */
        rustplus.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'invalidTimeDistance', {
                distance: distance,
                prevTime: prevTime,
                newTime: newTime,
            }),
            'error',
        );
        rustplus.passedFirstSunriseOrSunset = false;
        rustplus.time.startTime = newTime;
        rustplus.time.timeTillDay = {};
        rustplus.time.timeTillNight = {};
        rustplus.startTimeObject = {};
        rustplus.startTimeObject[newTime] = 0;
        return;
    }

    if (!rustplus.passedFirstSunriseOrSunset) {
        const a =
            rustplus.time.startTime >= time.sunrise &&
            rustplus.time.startTime < time.sunset &&
            (newTime >= time.sunset || newTime < time.sunrise);
        const b =
            (rustplus.time.startTime >= time.sunset || rustplus.time.startTime < time.sunrise) &&
            newTime >= time.sunrise &&
            newTime < time.sunset;

        for (const id in rustplus.startTimeObject) {
            rustplus.startTimeObject[id] += client.pollingIntervalMs / 1000;
        }

        if (a || b) {
            rustplus.passedFirstSunriseOrSunset = true;
        } else {
            rustplus.startTimeObject[newTime] = 0;
            return;
        }
    }

    const a = newTime > rustplus.time.startTime && prevTime < rustplus.time.startTime && newTime > prevTime;
    const b = newTime < rustplus.time.startTime && prevTime < rustplus.time.startTime && newTime < prevTime;
    const c = newTime > rustplus.time.startTime && prevTime > rustplus.time.startTime && newTime < prevTime;

    /* If 24 hours in-game time have passed */
    if (a || b || c) {
        /* Merge startTimeObject with correct object */
        let highestValue = 0;
        for (const id in rustplus.startTimeObject) {
            if (rustplus.startTimeObject[id] > highestValue) {
                highestValue = rustplus.startTimeObject[id];
            }
        }

        if (rustplus.time.startTime >= time.sunrise && rustplus.time.startTime < time.sunset) {
            for (const id in rustplus.time.timeTillNight) {
                rustplus.time.timeTillNight[id] += highestValue;
            }

            rustplus.time.timeTillNight = _.merge(rustplus.startTimeObject, rustplus.time.timeTillNight);
        } else {
            for (const id in rustplus.time.timeTillDay) {
                rustplus.time.timeTillDay[id] += highestValue;
            }

            rustplus.time.timeTillDay = _.merge(rustplus.startTimeObject, rustplus.time.timeTillDay);
        }

        rustplus.time.timeTillActive = true;

        const instance = await getPersistenceCache().readGuildState(rustplus.guildId);

        instance.serverList[rustplus.serverId].timeTillDay = rustplus.time.timeTillDay;
        instance.serverList[rustplus.serverId].timeTillNight = rustplus.time.timeTillNight;
        await getPersistenceCache().replaceServerTimeSamples(
            rustplus.guildId,
            rustplus.serverId,
            rustplus.time.timeTillDay,
            rustplus.time.timeTillNight,
        );

        rustplus.log(client.intlGet(null, 'timeCap'), client.intlGet(null, '24HoursInGameTimePassed'), 'info');
        return;
    }

    if (newTime >= time.sunrise && newTime < time.sunset) {
        /* It's Day */
        for (const id in rustplus.time.timeTillNight) {
            rustplus.time.timeTillNight[id] += client.pollingIntervalMs / 1000;
        }

        rustplus.time.timeTillNight[newTime] = 0;
    } else {
        /* It's Night */
        for (const id in rustplus.time.timeTillDay) {
            rustplus.time.timeTillDay[id] += client.pollingIntervalMs / 1000;
        }

        rustplus.time.timeTillDay[newTime] = 0;
    }
}
