import * as Discord from 'discord.js';
import * as Constants from '../domain/constants.js';
import { client } from '../index.js';
import type DiscordBot from '../structures/DiscordBot.js';
import { cwdPath } from '../utils/filesystemUtils.js';
import * as DiscordButtons from './discordButtons.js';
import * as DiscordEmbeds from './discordEmbeds.js';
import * as DiscordSelectMenus from './discordSelectMenus.js';
import * as DiscordTools from './discordTools.js';
import * as Scrape from '../infrastructure/scrape.js';
import { getPersistenceCache } from '../persistence/index.js';

export async function sendMessage(
    guildId: string,
    content: any,
    messageId: string | null,
    channelId: string,
    interaction: any = null,
) {
    if (interaction) {
        await client.interactionUpdate(interaction, content);
        return;
    }

    const message = messageId !== null ? await DiscordTools.getMessageById(guildId, channelId, messageId) : undefined;

    if (message !== undefined) {
        return await client.messageEdit(message, content);
    }

    const channel = DiscordTools.getTextChannelById(guildId, channelId);

    if (!channel) {
        client.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'couldNotGetChannelWithId', { id: channelId }),
            'error',
        );
        return;
    }

    return await client.messageSend(channel, content);
}

export async function sendServerMessage(guildId: string, serverId: string, state: any = null, interaction: any = null) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const server = instance.serverList[serverId];

    const content = {
        embeds: [await DiscordEmbeds.getServerEmbed(guildId, serverId)],
        components: await DiscordButtons.getServerButtons(guildId, serverId, state),
    };

    const message = await sendMessage(guildId, content, server.messageId, instance.channelId.servers, interaction);

    if (!interaction && message) {
        await getPersistenceCache().setServerMessageId(guildId, serverId, message.id);
    }
}

export async function sendTrackerMessage(guildId: string, trackerId: string, interaction: any = null) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const tracker = instance.trackers[trackerId];

    const content = {
        embeds: [await DiscordEmbeds.getTrackerEmbed(guildId, trackerId)],
        components: await DiscordButtons.getTrackerButtons(guildId, trackerId),
    };

    const message = await sendMessage(guildId, content, tracker.messageId, instance.channelId.trackers, interaction);

    if (!interaction && message) {
        await getPersistenceCache().setTrackerMessageId(guildId, trackerId, message.id);
    }
}

export async function sendSmartSwitchMessage(
    guildId: string,
    serverId: string,
    entityId: string,
    interaction: any = null,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].switches[entityId];

    const content = {
        embeds: [
            entity.reachable
                ? await DiscordEmbeds.getSmartSwitchEmbed(guildId, serverId, entityId)
                : await DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'switches'),
        ],
        components: [
            DiscordSelectMenus.getSmartSwitchSelectMenu(guildId, serverId, entityId),
            await DiscordButtons.getSmartSwitchButtons(guildId, serverId, entityId),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
    };

    const message = await sendMessage(guildId, content, entity.messageId, instance.channelId.switches, interaction);

    if (!interaction && message) {
        await getPersistenceCache().setSmartSwitchMessageId(guildId, serverId, entityId, message.id);
    }
}

export async function sendSmartAlarmMessage(
    guildId: string,
    serverId: string,
    entityId: string,
    interaction: any = null,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];

    const content = {
        embeds: [
            entity.reachable
                ? await DiscordEmbeds.getSmartAlarmEmbed(guildId, serverId, entityId)
                : await DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'alarms'),
        ],
        components: [await DiscordButtons.getSmartAlarmButtons(guildId, serverId, entityId)],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
    };

    const message = await sendMessage(guildId, content, entity.messageId, instance.channelId.alarms, interaction);

    if (!interaction && message) {
        await getPersistenceCache().setSmartAlarmMessageId(guildId, serverId, entityId, message.id);
    }
}

export async function sendStorageMonitorMessage(
    guildId: string,
    serverId: string,
    entityId: string,
    interaction: any = null,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];

    const content = {
        embeds: [
            entity.reachable
                ? await DiscordEmbeds.getStorageMonitorEmbed(guildId, serverId, entityId)
                : await DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'storageMonitors'),
        ],
        components: [
            entity.type === 'toolCupboard'
                ? await DiscordButtons.getStorageMonitorToolCupboardButtons(guildId, serverId, entityId)
                : DiscordButtons.getStorageMonitorContainerButton(guildId, serverId, entityId),
        ],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
    };

    const message = await sendMessage(
        guildId,
        content,
        entity.messageId,
        instance.channelId.storageMonitors,
        interaction,
    );

    if (!interaction && message) {
        await getPersistenceCache().setStorageMonitorMessageId(guildId, serverId, entityId, message.id);
    }
}

export async function sendSmartSwitchGroupMessage(
    guildId: string,
    serverId: string,
    groupId: string,
    interaction: any = null,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const group = instance.serverList[serverId].switchGroups[groupId];

    const content = {
        embeds: [await DiscordEmbeds.getSmartSwitchGroupEmbed(guildId, serverId, groupId)],
        components: DiscordButtons.getSmartSwitchGroupButtons(guildId, serverId, groupId),
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${group.image}`))],
    };

    const message = await sendMessage(guildId, content, group.messageId, instance.channelId.switchGroups, interaction);

    if (!interaction && message) {
        await getPersistenceCache().setSmartSwitchGroupMessageId(guildId, serverId, groupId, message.id);
    }
}

export async function sendStorageMonitorRecycleMessage(
    guildId: string,
    serverId: string,
    entityId: string,
    items: any,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    const content = {
        embeds: [await DiscordEmbeds.getStorageMonitorRecycleEmbed(guildId, serverId, entityId, items)],
        components: [DiscordButtons.getRecycleDeleteButton()],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/electrics/recycler.png'))],
    };

    return await sendMessage(guildId, content, null, instance.channelId.storageMonitors);
}

export async function sendDecayingNotificationMessage(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];

    const content: any = {
        embeds: [await DiscordEmbeds.getDecayingNotificationEmbed(guildId, serverId, entityId)],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
        content: entity.everyone ? '@everyone' : '',
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendStorageMonitorDisconnectNotificationMessage(
    guildId: string,
    serverId: string,
    entityId: string,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];

    const content: any = {
        embeds: [await DiscordEmbeds.getStorageMonitorDisconnectNotificationEmbed(guildId, serverId, entityId)],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
        content: entity.everyone ? '@everyone' : '',
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendStorageMonitorNotFoundMessage(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];

    const content: any = {
        embeds: [await DiscordEmbeds.getStorageMonitorNotFoundEmbed(guildId, serverId, entityId)],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
        content: entity.everyone ? '@everyone' : '',
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendSmartSwitchNotFoundMessage(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].switches[entityId];

    const content = {
        embeds: [await DiscordEmbeds.getSmartSwitchNotFoundEmbed(guildId, serverId, entityId)],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendSmartAlarmNotFoundMessage(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];

    const content: any = {
        embeds: [await DiscordEmbeds.getSmartAlarmNotFoundEmbed(guildId, serverId, entityId)],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
        content: entity.everyone ? '@everyone' : '',
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendSmartAlarmTriggerMessage(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];

    const content: any = {
        embeds: [await DiscordEmbeds.getAlarmEmbed(guildId, serverId, entityId)],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/electrics/${entity.image}`))],
        content: entity.everyone ? '@everyone' : '',
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendServerChangeStateMessage(guildId: string, serverId: string, state: any) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    const content = {
        embeds: [await DiscordEmbeds.getServerChangedStateEmbed(guildId, serverId, state)],
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendServerWipeDetectedMessage(guildId: string, serverId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    const content: any = {
        embeds: [await DiscordEmbeds.getServerWipeDetectedEmbed(guildId, serverId)],
        files: [new Discord.AttachmentBuilder(cwdPath(`maps/${guildId}_map_full.png`))],
        content: instance.generalSettings.mapWipeNotifyEveryone ? '@everyone' : '',
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendServerConnectionInvalidMessage(guildId: string, serverId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    const content = {
        embeds: [await DiscordEmbeds.getServerConnectionInvalidEmbed(guildId, serverId)],
    };

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendInformationMapMessage(guildId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    const content = {
        files: [new Discord.AttachmentBuilder(cwdPath(`maps/${guildId}_map_full.png`))],
    };

    const message = await sendMessage(
        guildId,
        content,
        instance.informationMessageId.map,
        instance.channelId.information,
    );

    if (message) {
        await getPersistenceCache().setDiscordReferencedIds(guildId, [
            { key: 'informationMessage.map', value: message.id },
        ]);
    }
}

export async function sendDiscordEventMessage(
    guildId: string,
    serverId: string,
    text: string,
    image: string,
    color: string,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    const content = {
        embeds: [await DiscordEmbeds.getEventEmbed(guildId, serverId, text, image, color)],
        files: [new Discord.AttachmentBuilder(cwdPath(`resources/images/events/${image}`))],
    };

    await sendMessage(guildId, content, null, instance.channelId.events);
}

export async function sendActivityNotificationMessage(
    guildId: string,
    serverId: string,
    color: string,
    text: string,
    steamId: string,
    title: string | null = null,
    everyone: boolean = false,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    let png = null;
    if (steamId !== null) {
        png = await Scrape.scrapeSteamProfilePicture(client, steamId);
    }
    const content: any = {
        embeds: [await DiscordEmbeds.getActivityNotificationEmbed(guildId, serverId, color, text, steamId, png, title)],
    };

    if (everyone) {
        content.content = '@everyone';
    }

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendTeamChatMessage(guildId: string, message: any) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    let color = Constants.COLOR_TEAMCHAT_DEFAULT;
    if (Object.hasOwn(instance.teamChatColors, message.steamId)) {
        color = instance.teamChatColors[message.steamId];
    }

    const content: any = {
        embeds: [
            DiscordEmbeds.getEmbed({
                color: color,
                description: `**${message.name}**: ${message.message}`,
            }),
        ],
    };

    if (message.message.includes('@everyone')) {
        content.content = '@everyone';
    }

    await sendMessage(guildId, content, null, instance.channelId.teamchat);
}

export async function sendTTSMessage(guildId: string, name: string, text: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    const content: any = {
        content: client.intlGet(guildId, 'userSaid', { user: name, text: text }),
        tts: true,
    };

    await sendMessage(guildId, content, null, instance.channelId.teamchat);
}

export async function sendUpdateMapInformationMessage(rustplus: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);

    const content = {
        files: [new Discord.AttachmentBuilder(cwdPath(`maps/${rustplus.guildId}_map_full.png`))],
    };

    const message = await sendMessage(
        rustplus.guildId,
        content,
        instance.informationMessageId.map,
        instance.channelId.information,
    );

    if (message && message.id !== instance.informationMessageId.map) {
        await getPersistenceCache().setDiscordReferencedIds(rustplus.guildId, [
            { key: 'informationMessage.map', value: message.id },
        ]);
    }
}

export async function sendUpdateServerInformationMessage(rustplus: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);

    const content = {
        embeds: [await DiscordEmbeds.getUpdateServerInformationEmbed(rustplus)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/server_info_logo.png'))],
    };

    const message = await sendMessage(
        rustplus.guildId,
        content,
        instance.informationMessageId.server,
        instance.channelId.information,
    );

    if (message && message.id !== instance.informationMessageId.server) {
        await getPersistenceCache().setDiscordReferencedIds(rustplus.guildId, [
            { key: 'informationMessage.server', value: message.id },
        ]);
    }
}

export async function sendUpdateEventInformationMessage(rustplus: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);

    const content = {
        embeds: [await DiscordEmbeds.getUpdateEventInformationEmbed(rustplus)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/event_info_logo.png'))],
    };

    const message = await sendMessage(
        rustplus.guildId,
        content,
        instance.informationMessageId.event,
        instance.channelId.information,
    );

    if (message && message.id !== instance.informationMessageId.event) {
        await getPersistenceCache().setDiscordReferencedIds(rustplus.guildId, [
            { key: 'informationMessage.event', value: message.id },
        ]);
    }
}

export async function sendUpdateTeamInformationMessage(rustplus: any) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);

    const content = {
        embeds: [await DiscordEmbeds.getUpdateTeamInformationEmbed(rustplus)],
        files: [new Discord.AttachmentBuilder(cwdPath('resources/images/team_info_logo.png'))],
    };

    const message = await sendMessage(
        rustplus.guildId,
        content,
        instance.informationMessageId.team,
        instance.channelId.information,
    );

    if (message && message.id !== instance.informationMessageId.team) {
        await getPersistenceCache().setDiscordReferencedIds(rustplus.guildId, [
            { key: 'informationMessage.team', value: message.id },
        ]);
    }
}

export async function sendUpdateBattlemetricsOnlinePlayersInformationMessage(rustplus: any, battlemetricsId: string) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);

    const content = {
        embeds: [DiscordEmbeds.getUpdateBattlemetricsOnlinePlayersInformationEmbed(rustplus, battlemetricsId)],
    };

    const message = await sendMessage(
        rustplus.guildId,
        content,
        instance.informationMessageId.battlemetricsPlayers,
        instance.channelId.information,
    );

    if (message && message.id !== instance.informationMessageId.battlemetricsPlayers) {
        await getPersistenceCache().setDiscordReferencedIds(rustplus.guildId, [
            { key: 'informationMessage.battlemetricsPlayers', value: message.id },
        ]);
    }
}

export async function sendDiscordCommandResponseMessage(
    rustplus: any,
    client: DiscordBot,
    message: any,
    response: any,
) {
    const content = {
        embeds: [await DiscordEmbeds.getDiscordCommandResponseEmbed(rustplus, response)],
    };

    await client.messageReply(message, content);
}

export async function sendCredentialsShowMessage(interaction: any) {
    const content = {
        embeds: [await DiscordEmbeds.getCredentialsShowEmbed(interaction.guildId)],
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionEditReply(interaction, content);
}

export async function sendItemAvailableInVendingMachineMessage(rustplus: any, str: string) {
    const instance = await getPersistenceCache().readGuildState(rustplus.guildId);

    const content = {
        embeds: [await DiscordEmbeds.getItemAvailableVendingMachineEmbed(rustplus.guildId, rustplus.serverId, str)],
    };

    await sendMessage(rustplus.guildId, content, null, instance.channelId.activity);
}

export async function sendHelpMessage(interaction: any) {
    const content = {
        embeds: [DiscordEmbeds.getHelpEmbed(interaction.guildId)],
        components: DiscordButtons.getHelpButtons(),
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionReply(interaction, content);
}

export async function sendCctvMessage(interaction: any, monument: string, cctvCodes: any, dynamic: boolean) {
    const content = {
        embeds: [DiscordEmbeds.getCctvEmbed(interaction.guildId, monument, cctvCodes, dynamic)],
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionReply(interaction, content);
}

export async function sendUptimeMessage(interaction: any, uptime: any) {
    const content = {
        embeds: [DiscordEmbeds.getUptimeEmbed(interaction.guildId, uptime)],
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionEditReply(interaction, content);
}

export async function sendVoiceMessage(interaction: any, state: any) {
    const content = {
        embeds: [DiscordEmbeds.getVoiceEmbed(interaction.guildId, state)],
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionEditReply(interaction, content);
}

export async function sendCraftMessage(interaction: any, craftDetails: any, quantity: number) {
    const content = {
        embeds: [DiscordEmbeds.getCraftEmbed(interaction.guildId, craftDetails, quantity)],
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionEditReply(interaction, content);
}

export async function sendResearchMessage(interaction: any, researchDetails: any) {
    const content = {
        embeds: [DiscordEmbeds.getResearchEmbed(interaction.guildId, researchDetails)],
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionEditReply(interaction, content);
}

export async function sendRecycleMessage(
    interaction: any,
    recycleDetails: any,
    quantity: number,
    recyclerType: string,
) {
    const content = {
        embeds: [DiscordEmbeds.getRecycleEmbed(interaction.guildId, recycleDetails, quantity, recyclerType)],
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionEditReply(interaction, content);
}

export async function sendBattlemetricsEventMessage(
    guildId: string,
    battlemetricsId: string,
    title: string,
    description: string,
    fields: any = null,
    everyone: boolean = false,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);

    const content: any = {
        embeds: [await DiscordEmbeds.getBattlemetricsEventEmbed(guildId, battlemetricsId, title, description, fields)],
    };

    if (everyone) {
        content.content = '@everyone';
    }

    await sendMessage(guildId, content, null, instance.channelId.activity);
}

export async function sendItemMessage(interaction: any, itemName: string, itemId: string, type: string) {
    const content = {
        embeds: [DiscordEmbeds.getItemEmbed(interaction.guildId, itemName, itemId, type)],
        flags: Discord.MessageFlags.Ephemeral,
    };

    await client.interactionEditReply(interaction, content);
}
