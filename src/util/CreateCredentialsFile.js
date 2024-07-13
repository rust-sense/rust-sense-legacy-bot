const Fs = require('node:fs');
const Path = require('node:path');

module.exports = (client, guild) => {
    if (!Fs.existsSync(Path.join(__dirname, '..', '..', 'credentials', `${guild.id}.json`))) {
        Fs.writeFileSync(
            Path.join(__dirname, '..', '..', 'credentials', `${guild.id}.json`),
            JSON.stringify({ hoster: null }, null, 2),
        );
    }
};
