const DiscordMessages = require('../discordTools/discordMessages');
const Timer = require('../util/timer');

module.exports = {
    handler: async function (rustplus, client) {
        let instance = client.getInstance(rustplus.guildId);
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;

        if (!instance.serverList.hasOwnProperty(serverId)) return;

        if (rustplus.smartAlarmIntervalCounter === 29) {
            rustplus.smartAlarmIntervalCounter = 0;
        } else {
            rustplus.smartAlarmIntervalCounter += 1;
        }

        if (rustplus.smartAlarmIntervalCounter === 0) {
            for (const entityId in instance.serverList[serverId].alarms) {
                instance = client.getInstance(guildId);

                const info = await rustplus.getEntityInfoAsync(entityId);
                if (!rustplus.isResponseValid(info)) {
                    if (instance.serverList[serverId].alarms[entityId].reachable) {
                        await DiscordMessages.sendSmartAlarmNotFoundMessage(guildId, serverId, entityId);

                        instance.serverList[serverId].alarms[entityId].reachable = false;
                        client.setInstance(guildId, instance);

                        await DiscordMessages.sendSmartAlarmMessage(guildId, serverId, entityId);
                    }
                } else {
                    if (!instance.serverList[serverId].alarms[entityId].reachable) {
                        instance.serverList[serverId].alarms[entityId].reachable = true;
                        client.setInstance(guildId, instance);

                        await DiscordMessages.sendSmartAlarmMessage(guildId, serverId, entityId);
                    }
                }
            }
        }
    },

    smartAlarmCommandHandler: function (rustplus, client, command) {
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;
        const instance = client.getInstance(guildId);
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
        const timeSinceTriggerSeconds = Math.floor((new Date() - lastTriggerDate) / 1000);
        const time = Timer.secondsToFullScale(timeSinceTriggerSeconds);

        rustplus.sendInGameMessage(
            client.intlGet(guildId, 'timeSinceAlarmWasTriggered', {
                alarm: alarms[entityId].name,
                time: time,
            }),
        );
        return true;
    },
};
