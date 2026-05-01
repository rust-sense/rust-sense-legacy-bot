import type { DiscordBot } from '../types/discord.js';
import * as DiscordMessages from './discordMessages.js';
import * as DiscordTools from './discordTools.js';

export default async function setupSwitches(client: DiscordBot, rustplus: any) {
    const instance = client.getInstance(rustplus.guildId);
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;

    if (rustplus.isNewConnection) {
        await DiscordTools.clearTextChannel(guildId, instance.channelId.switches as string, 100);
    }

    for (const entityId in instance.serverList[serverId].switches) {
        const entity = instance.serverList[serverId].switches[entityId];
        const info = await rustplus.getEntityInfoAsync(entityId);

        if (!(await rustplus.isResponseValid(info))) {
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
}
