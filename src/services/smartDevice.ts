import { client } from '../index.js';
import { getPersistenceCache } from '../persistence/index.js';

export async function getSmartDevice(guildId: string, entityId: string) {
    /* Temporary function till discord modals gets more functional */
    const instance = await getPersistenceCache().readGuildState(guildId);

    for (const serverId in instance.serverList) {
        for (const switchId in instance.serverList[serverId].switches) {
            if (entityId === switchId) {
                return {
                    type: 'switch',
                    serverId: serverId,
                };
            }
        }

        for (const alarmId in instance.serverList[serverId].alarms) {
            if (entityId === alarmId) {
                return {
                    type: 'alarm',
                    serverId: serverId,
                };
            }
        }

        for (const storageMonitorId in instance.serverList[serverId].storageMonitors) {
            if (entityId === storageMonitorId) {
                return {
                    type: 'storageMonitor',
                    serverId: serverId,
                };
            }
        }
    }

    return null;
}
