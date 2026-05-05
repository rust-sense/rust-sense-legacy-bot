import { getPersistenceCache } from '../persistence/index.js';
import type { DiscordBot } from '../types/discord.js';
import * as DiscordMessages from './discordMessages.js';

export default async function setupAlarms(client: DiscordBot, rustplus: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;

    for (const entityId in instance.serverList[serverId].alarms) {
        const entity = instance.serverList[serverId].alarms[entityId];
        const info = await rustplus.getEntityInfoAsync(entityId);

        if (!(await rustplus.isResponseValid(info))) {
            if (entity.reachable === true) {
                await DiscordMessages.sendSmartAlarmNotFoundMessage(guildId, serverId, entityId);
            }
            entity.reachable = false;
        } else {
            entity.reachable = true;
        }

        if (entity.reachable) entity.active = info.entityInfo.payload.value;

        await getPersistenceCache().updateSmartAlarmFields(guildId, serverId, entityId, {
            active: entity.active,
            reachable: entity.reachable,
        });

        await DiscordMessages.sendSmartAlarmMessage(guildId, serverId, entityId);
    }
}
