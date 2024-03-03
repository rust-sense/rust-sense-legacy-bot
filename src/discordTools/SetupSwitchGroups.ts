import DiscordMessages from './discordMessages.js';

import DiscordTools from './discordTools.js';

export default async (client, rustplus) => {
    const instance = client.getInstance(rustplus.guildId);
    const guildId = rustplus.guildId;

    if (rustplus.isNewConnection) {
        await DiscordTools.clearTextChannel(guildId, instance.channelId.switchGroups, 100);
    }

    for (const groupId in instance.serverList[rustplus.serverId].switchGroups) {
        await DiscordMessages.sendSmartSwitchGroupMessage(rustplus.guildId, rustplus.serverId, groupId);
    }
};
