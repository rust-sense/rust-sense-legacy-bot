const fs = require('node:fs');
import { cwdPath } from '../utils/filesystemUtils';

module.exports = (client, guild) => {
    const guildCredentialsFilePath = cwdPath('credentials', `${guild.id}.json`);
    if (!fs.existsSync(guildCredentialsFilePath)) {
        fs.writeFileSync(guildCredentialsFilePath, JSON.stringify({ hoster: null }, null, 2));
    }
};
