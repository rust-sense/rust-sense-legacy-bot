const fs = require('node:fs');

const Client = require('../index');

import { loadJson, cwdPath, writeJson, writeJsonSync, loadJsonSync } from '../service/resourceManager';

module.exports = {
    getSmartDevice: (guildId, entityId) => {
        /* Temporary function till discord modals gets more functional */
        const instance = Client.client.getInstance(guildId);

        for (const serverId in instance.serverList) {
            for (const switchId in instance.serverList[serverId].switches) {
                if (entityId === switchId) return { type: 'switch', serverId: serverId };
            }
            for (const alarmId in instance.serverList[serverId].alarms) {
                if (entityId === alarmId) return { type: 'alarm', serverId: serverId };
            }
            for (const storageMonitorId in instance.serverList[serverId].storageMonitors) {
                if (entityId === storageMonitorId) return { type: 'storageMonitor', serverId: serverId };
            }
        }
        return null;
    },

    readInstanceFile: (guildId) => {
        return loadJsonSync(cwdPath('instances', `${guildId}.json`));
    },

    writeInstanceFile: (guildId, instance) => {
        writeJsonSync(cwdPath('instances', `${guildId}.json`), instance);
    },

    readCredentialsFile: (guildId) => {
        return loadJsonSync(cwdPath('credentials', `${guildId}.json`));
    },

    writeCredentialsFile: (guildId, credentials) => {
        writeJsonSync(cwdPath('credentials', `${guildId}.json`), credentials);
    },
};
