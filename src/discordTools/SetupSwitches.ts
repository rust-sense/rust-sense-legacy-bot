const DiscordMessages = require('./discordMessages');
const DiscordTools = require('./discordTools');

module.exports = async (client, rustplus) => {
    const instance = client.getInstance(rustplus.guildId);
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;

    if (rustplus.isNewConnection) {
        await DiscordTools.clearTextChannel(guildId, instance.channelId.switches, 100);
    }

    for (const entityId in instance.serverList[serverId].switches) {
        const entity = instance.serverList[serverId].switches[entityId];
        const info = await rustplus.getEntityInfoAsync(entityId);

        if (!rustplus.isResponseValid(info)) {
            if (entity.reachable === true) {
                await DiscordMessages.sendSmartSwitchNotFoundMessage(guildId, serverId, entityId);
            }
            entity.reachable = false;
        } else {
            entity.reachable = true;
        }

        if (entity.reachable) entity.active = info.entityInfo.payload.value;

        client.setInstance(guildId, instance);

        await DiscordMessages.sendSmartSwitchMessage(guildId, serverId, entityId);
    }
};
