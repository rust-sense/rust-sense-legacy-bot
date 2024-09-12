const fs = require('node:fs');

import { loadJson, cwdPath, writeJson, writeJsonSync, loadJsonSync } from '../service/resourceManager';

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

    readAuthTokensFile: (guildId) => {
        return loadJsonSync(cwdPath('authtokens', `${guildId}.json`));
    },

    writeAuthTokensFile: (guildId, authTokens) => {
        writeJsonSync(cwdPath('authtokens', `${guildId}.json`), credentials);
    },
}