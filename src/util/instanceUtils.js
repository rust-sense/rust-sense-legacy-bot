const fs = require('node:fs');

import { cwdPath, loadJson, loadJsonSync, writeJson, writeJsonSync } from '../utils/filesystemUtils';

module.exports = {
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
