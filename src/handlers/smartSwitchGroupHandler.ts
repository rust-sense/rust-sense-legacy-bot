import type DiscordBot from '../structures/DiscordBot.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as Timer from '../util/timer.js';

export async function handler(rustplus: any, client: DiscordBot) {}

export async function updateSwitchGroupIfContainSwitch(client: DiscordBot, guildId: string, serverId: string, switchId: string) {
    const instance = client.getInstance(guildId);

    for (const [groupId, content] of Object.entries(instance.serverList[serverId].switchGroups as Record<string, any>)) {
        if (content.switches.includes(`${switchId}`)) {
            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);
        }
    }
}

export function getGroupsFromSwitchList(client: DiscordBot, guildId: string, serverId: string, switches: string[]) {
    const instance = client.getInstance(guildId);

    let groupsId = [];
    for (let entity of switches) {
        for (const [groupId, content] of Object.entries(instance.serverList[serverId].switchGroups as Record<string, any>)) {
            if (content.switches.includes(entity) && !groupsId.includes(groupId)) {
                groupsId.push(groupId);
            }
        }
    }

    return groupsId;
}

export async function TurnOnOffGroup(client: DiscordBot, rustplus: any, guildId: string, serverId: string, groupId: string, value: boolean) {
    const instance = client.getInstance(guildId);

    const switches = instance.serverList[serverId].switchGroups[groupId].switches;

    const actionSwitches = [];
    for (const [entityId, content] of Object.entries(instance.serverList[serverId].switches as Record<string, any>)) {
        if (switches.includes(entityId)) {
            if (Object.hasOwn(rustplus.currentSwitchTimeouts, entityId)) {
                clearTimeout(rustplus.currentSwitchTimeouts[entityId]);
                delete rustplus.currentSwitchTimeouts[entityId];
            }

            if (value && !content.active) {
                actionSwitches.push(entityId);
            } else if (!value && content.active) {
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
        if (!rustplus.isResponseValid(response)) {
            if (instance.serverList[serverId].switches[entityId].reachable) {
                await DiscordMessages.sendSmartSwitchNotFoundMessage(guildId, serverId, entityId);
            }
            instance.serverList[serverId].switches[entityId].reachable = false;
            instance.serverList[serverId].switches[entityId].active = prevActive;
            client.setInstance(guildId, instance);

            rustplus.interactionSwitches = rustplus.interactionSwitches.filter((e: string) => e !== entityId);
        } else {
            instance.serverList[serverId].switches[entityId].reachable = true;
            client.setInstance(guildId, instance);
        }

        DiscordMessages.sendSmartSwitchMessage(guildId, serverId, entityId);
    }

    if (actionSwitches.length !== 0) {
        await DiscordMessages.sendSmartSwitchGroupMessage(guildId, serverId, groupId);
    }
}

export async function smartSwitchGroupCommandHandler(rustplus: any, client: DiscordBot, command: string) {
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
        const switchStatus = switchGroups[groupId].switches.map((switchId: string) => {
            const { active, name, reachable } = instance.serverList[serverId].switches[switchId];
            return { active, name, reachable };
        });
        const statusMessage = switchStatus
            .map((status: any) => `${status.name}: ${status.reachable ? (status.active ? onCap : offCap) : notFoundCap}`)
            .join(', ');
        rustplus.sendInGameMessage(`${client.intlGet(guildId, 'status')}: ${statusMessage}`);
        return true;
    } else {
        return true;
    }

    if (Object.hasOwn(rustplus.currentSwitchTimeouts, groupId)) {
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
        'info',
    );

    if (timeSeconds === null) {
        rustplus.sendInGameMessage(str);
        await TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, active);
        return true;
    }

    const time = Timer.secondsToFullScale(timeSeconds);
    str += client.intlGet(guildId, 'automaticallyTurnBackOnOff', {
        status: active ? offCap : onCap,
        time: time,
    });

    rustplus.currentSwitchTimeouts[groupId] = setTimeout(async function () {
        const instance = client.getInstance(guildId);
        if (
            !Object.hasOwn(instance.serverList, serverId) ||
            !Object.hasOwn(instance.serverList[serverId].switchGroups, groupId)
        ) {
            return;
        }

        const str = client.intlGet(guildId, 'automaticallyTurningBackOnOff', {
            device: instance.serverList[serverId].switchGroups[groupId].name,
            status: !active ? onCap : offCap,
        });
        rustplus.sendInGameMessage(str);

        await TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, !active);
    }, timeSeconds * 1000);

    rustplus.sendInGameMessage(str);
    await TurnOnOffGroup(client, rustplus, guildId, serverId, groupId, active);
    return true;
}