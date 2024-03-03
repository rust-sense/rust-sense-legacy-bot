import Fs from 'fs';

import Path from 'path';

export default (client, guild) => {
    if (!Fs.existsSync(Path.join(__dirname, '..', '..', 'credentials', `${guild.id}.json`))) {
        Fs.writeFileSync(
            Path.join(__dirname, '..', '..', 'credentials', `${guild.id}.json`),
            JSON.stringify({ hoster: null }, null, 2),
        );
    }
};
