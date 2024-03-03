import DiscordMessages from './discordMessages.js';

import DiscordTools from './discordTools.js';

export default async (client, guild) => {
    const instance = client.getInstance(guild.id);

    await DiscordTools.clearTextChannel(guild.id, instance.channelId.trackers, 100);

    for (const trackerId in instance.trackers) {
        await DiscordMessages.sendTrackerMessage(guild.id, trackerId);
    }
};
