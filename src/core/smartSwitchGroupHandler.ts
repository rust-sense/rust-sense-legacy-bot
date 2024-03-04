import DiscordMessages from '../discordTools/discordMessages.js';

import Timer from '../util/timer';

export default {
    handler: async function (rustplus, client) {},

    updateSwitchGroupIfContainSwitch: async function (client, guildId, serverId, switchId) {
        const instance = client.getInstance(guildId);

        for (const [groupId, content] of Object.entries(instance.serverList[serverId].switchGroups)) {
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            if (content.switches.includes(`${switchId}`)) {
                await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);
            }
        }
    },

    getGroupsFromSwitchList: function (client, guildId, serverId, switches) {
        const instance = client.getInstance(guildId);

        const groupsId = [];
        for (const entity of switches) {
            for (const [groupId, content] of Object.entries(instance.serverList[serverId].switchGroups)) {
                // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                if (content.switches.includes(entity) && !groupsId.includes(groupId)) {
                    // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                    groupsId.push(groupId);
                }
            }
        }

        return groupsId;
    },

    TurnOnOffGroup: async function (client, rustplus, guildId, serverId, groupId, value) {
        const instance = client.getInstance(guildId);

        const switches = instance.serverList[serverId].switchGroups[groupId].switches;

        const actionSwitches = [];
        for (const [entityId, content] of Object.entries(instance.serverList[serverId].switches)) {
            if (switches.includes(entityId)) {
                if (rustplus.currentSwitchTimeouts.hasOwn(entityId)) {
                    clearTimeout(rustplus.currentSwitchTimeouts[entityId]);
                    delete rustplus.currentSwitchTimeouts[entityId];
                }

                // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                if (value && !content.active) {
                    // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                    actionSwitches.push(entityId);
                }
                // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                else if (!value && content.active) {
                    // @ts-expect-error TS(2345) FIXME: Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
                    actionSwitches.push(entityId);
                }
            }
        }

        for (const entityId of actionSwitches) {
            const prevActive = instance.serverList[serverId].switches[entityId].active;
            instance.serverList[serverId].switches[entityId].active = value;
            client.setInstance(guildId, instance);

            rustplus.interactionSwitches.push(entityId);

            const response = await rustplus.turnSmartSwitchAsync(entityId, value);
            if (!(await rustplus.isResponseValid(response))) {
                if (instance.serverList[serverId].switches[entityId].reachable) {
                    await DiscordMessages.sendSmartSwitchNotFoundMessage(guildId, serverId, entityId);
                }
                instance.serverList[serverId].switches[entityId].reachable = false;
                instance.serverList[serverId].switches[entityId].active = prevActive;
                client.setInstance(guildId, instance);

                rustplus.interactionSwitches = rustplus.interactionSwitches.filter((e) => e !== entityId);
            } else {
                instance.serverList[serverId].switches[entityId].reachable = true;
                client.setInstance(guildId, instance);
            }

            DiscordMessages.sendSmartSwitchMessage(guildId, serverId, entityId);
        }

        if (actionSwitches.length !== 0) {
            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);
        }
    },

    smartSwitchGroupCommandHandler: async function (rustplus, client, command) {
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;
        const instance = client.getInstance(guildId);
        const switchGroups = instance.serverList[serverId].switchGroups;
        const prefix = rustplus.generalSettings.prefix;

        const onCap = client.intlGet(rustplus.guildId, 'onCap');
        const offCap = client.intlGet(rustplus.guildId, 'offCap');
        const notFoundCap = client.intlGet(rustplus.guildId, 'notFoundCap');

        const onEn = client.intlGet('en', 'commandSyntaxOn');
        const onLang = client.intlGet(guildId, 'commandSyntaxOn');
        const offEn = client.intlGet('en', 'commandSyntaxOff');
        const offLang = client.intlGet(guildId, 'commandSyntaxOff');
        const statusEn = client.intlGet('en', 'commandSyntaxStatus');
        const statusLang = client.intlGet(guildId, 'commandSyntaxStatus');

        const groupId = Object.keys(switchGroups).find(
            (e) =>
                command === `${prefix}${switchGroups[e].command}` ||
                command.startsWith(`${prefix}${switchGroups[e].command} `),
        );

        if (!groupId) return false;

        const groupCommand = `${prefix}${switchGroups[groupId].command}`;
        let rest = command.replace(`${groupCommand} ${onEn}`, '');
        rest = rest.replace(`${groupCommand} ${onLang}`, '');
        rest = rest.replace(`${groupCommand} ${offEn}`, '');
        rest = rest.replace(`${groupCommand} ${offLang}`, '');
        rest = rest.replace(`${groupCommand}`, '').trim();

        let active;
        if (command.startsWith(`${groupCommand} ${onEn}`) || command.startsWith(`${groupCommand} ${onLang}`)) {
            active = true;
        } else if (command.startsWith(`${groupCommand} ${offEn}`) || command.startsWith(`${groupCommand} ${offLang}`)) {
            active = false;
        } else if (command === `${groupCommand} ${statusEn}` || command === `${groupCommand} ${statusLang}`) {
            const switchStatus = switchGroups[groupId].switches.map((switchId) => {
                const { active, name, reachable } = instance.serverList[serverId].switches[switchId];
                return { active, name, reachable };
            });
            const statusMessage = switchStatus
                .map((status) => `${status.name}: ${status.reachable ? (status.active ? onCap : offCap) : notFoundCap}`)
                .join(', ');
            rustplus.sendInGameMessage(`${client.intlGet(guildId, 'status')}: ${statusMessage}`);
            return true;
        } else {
            return true;
        }

        if (rustplus.currentSwitchTimeouts.hasOwn(groupId)) {
            clearTimeout(rustplus.currentSwitchTimeouts[groupId]);
            delete rustplus.currentSwitchTimeouts[groupId];
        }

        const timeSeconds = Timer.getSecondsFromStringTime(rest);

        let str = client.intlGet(guildId, 'turningGroupOnOff', {
            group: switchGroups[groupId].name,
            status: active ? onCap : offCap,
        });

        rustplus.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, `logSmartSwitchGroupValueChange`, {
                value: active,
            }),
        );

        if (timeSeconds === null) {
            rustplus.sendInGameMessage(str);
            await module.exports.TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, active);
            return true;
        }

        const time = Timer.secondsToFullScale(timeSeconds);
        str += client.intlGet(guildId, 'automaticallyTurnBackOnOff', {
            status: active ? offCap : onCap,
            time: time,
        });

        rustplus.currentSwitchTimeouts[groupId] = setTimeout(async function () {
            const instance = client.getInstance(guildId);
            if (!instance.serverList.hasOwn(serverId) || !instance.serverList[serverId].switchGroups.hasOwn(groupId)) {
                return;
            }

            const str = client.intlGet(guildId, 'automaticallyTurningBackOnOff', {
                device: instance.serverList[serverId].switchGroups[groupId].name,
                status: !active ? onCap : offCap,
            });
            rustplus.sendInGameMessage(str);

            await module.exports.TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, !active);
        }, timeSeconds * 1000);

        rustplus.sendInGameMessage(str);
        await module.exports.TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, active);
        return true;
    },
};
