import * as Discord from 'discord.js';

import { client } from '../index.js';
import * as Constants from '../util/constants.js';
import * as InstanceUtils from '../util/instanceUtils.js';
import { secondsToFullScale } from '../util/timer.js';
import * as Utils from '../util/utils.js';
import * as DiscordTools from './discordTools.js';

function isValidUrl(url: string): boolean {
    if (url.startsWith('https') || url.startsWith('http')) {
        return true;
    }

    return false;
}

export function getEmbed(options: any = {}) {
    const embed = new Discord.EmbedBuilder();

    if (Object.hasOwn(options, 'title')) embed.setTitle(options.title);
    if (Object.hasOwn(options, 'color')) embed.setColor(options.color);
    if (Object.hasOwn(options, 'description')) embed.setDescription(options.description);
    if (Object.hasOwn(options, 'thumbnail') && options.thumbnail !== '') embed.setThumbnail(options.thumbnail);
    if (Object.hasOwn(options, 'image')) embed.setImage(options.image);
    if (Object.hasOwn(options, 'url') && options.url !== '') embed.setURL(options.url);
    if (Object.hasOwn(options, 'author')) embed.setAuthor(options.author);
    if (Object.hasOwn(options, 'footer')) embed.setFooter(options.footer);
    if (Object.hasOwn(options, 'timestamp')) embed.setTimestamp();
    if (Object.hasOwn(options, 'fields')) embed.setFields(...options.fields);

    return embed;
}

export function getSmartSwitchEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId].switches[entityId];
    const grid = Utils.getGridSuffix(entity.location);

    return getEmbed({
        title: `${entity.name}${grid}`,
        color: entity.active ? Constants.COLOR_ACTIVE : Constants.COLOR_INACTIVE,
        description: `**ID**: \`${entityId}\``,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        fields: [
            {
                name: client.intlGet(guildId, 'customCommand'),
                value: `\`${instance.generalSettings.prefix}${entity.command}\``,
                inline: true,
            },
        ],
        timestamp: true,
    });
}

export async function getServerEmbed(guildId, serverId) {
    const instance = client.getInstance(guildId);
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const server = instance.serverList[serverId];
    let hoster: any = client.intlGet(guildId, 'unknown');
    if (Object.hasOwn(credentials, server.steamId)) {
        hoster = await DiscordTools.getUserById(guildId, credentials[server.steamId].discord_user_id);
        hoster = hoster.user.username;
    }

    let description = '';
    if (server.battlemetricsId !== null) {
        const bmId = server.battlemetricsId;
        const bmIdLink = `[${bmId}](${Constants.BATTLEMETRICS_SERVER_URL}${bmId})`;
        description += `__**${client.intlGet(guildId, 'battlemetricsId')}:**__ ${bmIdLink}\n`;

        const bmInstance = client.battlemetricsInstances[bmId];
        if (bmInstance) {
            description += `__**${client.intlGet(guildId, 'streamerMode')}:**__ `;
            description += Utils.getActiveStr(client, guildId, bmInstance.streamerMode) + '\n';
        }
    }
    description += `\n${server.description}`;

    return getEmbed({
        title: `${server.title}`,
        color: Constants.COLOR_DEFAULT,
        description: description,
        thumbnail: `${server.img}`,
        fields: [
            {
                name: client.intlGet(guildId, 'connect'),
                value: `\`${server.connect === null ? client.intlGet(guildId, 'unavailable') : server.connect}\``,
                inline: true,
            },
            {
                name: client.intlGet(guildId, 'hoster'),
                value: `\`${hoster} (${server.steamId})\``,
                inline: false,
            },
        ],
    });
}

export function getTrackerEmbed(guildId, trackerId) {
    const instance = client.getInstance(guildId);
    const tracker = instance.trackers[trackerId];
    const battlemetricsId = tracker.battlemetricsId;
    const bmInstance = client.battlemetricsInstances[battlemetricsId];

    const successful = bmInstance && bmInstance.lastUpdateSuccessful ? true : false;

    const battlemetricsLink = `[${battlemetricsId}](${Constants.BATTLEMETRICS_SERVER_URL}${battlemetricsId})`;
    const serverStatus = !successful
        ? Constants.NOT_FOUND_EMOJI
        : bmInstance.server_status
          ? Constants.ONLINE_EMOJI
          : Constants.OFFLINE_EMOJI;

    let description = `__**Battlemetrics ID:**__ ${battlemetricsLink}\n`;
    description += `__**${client.intlGet(guildId, 'serverId')}:**__ ${tracker.serverId}\n`;
    description += `__**${client.intlGet(guildId, 'serverStatus')}:**__ ${serverStatus}\n`;
    description += `__**${client.intlGet(guildId, 'streamerMode')}:**__ `;
    description +=
        (!bmInstance
            ? Constants.NOT_FOUND_EMOJI
            : bmInstance.streamerMode
              ? client.intlGet(guildId, 'onCap')
              : client.intlGet(guildId, 'offCap')) + '\n';
    description += `__**${client.intlGet(guildId, 'clanTag')}:**__ `;
    description += tracker.clanTag !== '' ? `\`${tracker.clanTag}\`` : '';

    let totalCharacters = description.length;
    let fieldIndex = 0;
    let playerName = [''],
        playerId = [''],
        playerStatus = [''];
    let playerNameCharacters = 0,
        playerIdCharacters = 0,
        playerStatusCharacters = 0;
    for (const player of tracker.players) {
        let name = `${player.name}`;

        const nameMaxLength = Constants.EMBED_FIELD_MAX_WIDTH_LENGTH_3;
        name = name.length <= nameMaxLength ? name : name.substring(0, nameMaxLength - 2) + '..';
        name += '\n';

        let id = '';
        let status = '';

        const steamIdLink = Constants.GET_STEAM_PROFILE_LINK(player.steamId);
        const bmIdLink = Constants.GET_BATTLEMETRICS_PROFILE_LINK(player.playerId);

        const isNewLine = player.steamId !== null && player.playerId !== null ? true : false;
        id += `${player.steamId !== null ? steamIdLink : ''}`;
        id += `${player.steamId !== null && player.playerId !== null ? ' /\n' : ''}`;
        id += `${player.playerId !== null ? bmIdLink : ''}`;
        id += `${player.steamId === null && player.playerId === null ? client.intlGet(guildId, 'empty') : ''}`;
        id += '\n';

        if (!Object.hasOwn(bmInstance.players, player.playerId) || !successful) {
            status += `${Constants.NOT_FOUND_EMOJI}\n`;
        } else {
            let time = null;
            if (bmInstance.players[player.playerId]['status']) {
                time = bmInstance.getOnlineTime(player.playerId);
                status += `${Constants.ONLINE_EMOJI}`;
            } else {
                time = bmInstance.getOfflineTime(player.playerId);
                status += `${Constants.OFFLINE_EMOJI}`;
            }
            status += time !== null ? ` [${time[1]}]\n` : '\n';
        }

        if (isNewLine) {
            name += '\n';
            status += '\n';
        }

        if (totalCharacters + (name.length + id.length + status.length) >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
            break;
        }

        if (
            playerNameCharacters + name.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
            playerIdCharacters + id.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
            playerStatusCharacters + status.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS
        ) {
            fieldIndex += 1;

            playerName.push('');
            playerId.push('');
            playerStatus.push('');

            playerNameCharacters = 0;
            playerIdCharacters = 0;
            playerStatusCharacters = 0;
        }

        playerNameCharacters += name.length;
        playerIdCharacters += id.length;
        playerStatusCharacters += status.length;

        totalCharacters += name.length + id.length + status.length;

        playerName[fieldIndex] += name;
        playerId[fieldIndex] += id;
        playerStatus[fieldIndex] += status;
    }

    const fields = [];
    for (let i = 0; i < fieldIndex + 1; i++) {
        fields.push({
            name: i === 0 ? `__${client.intlGet(guildId, 'name')}__\n\u200B` : '\u200B',
            value: playerName[i] !== '' ? playerName[i] : client.intlGet(guildId, 'empty'),
            inline: true,
        });
        fields.push({
            name:
                i === 0
                    ? `__${client.intlGet(guildId, 'steamId')}__ /\n` +
                      `__${client.intlGet(guildId, 'battlemetricsId')}__`
                    : '\u200B',
            value: playerId[i] !== '' ? playerId[i] : client.intlGet(guildId, 'empty'),
            inline: true,
        });
        fields.push({
            name: i === 0 ? `__${client.intlGet(guildId, 'status')}__\n\u200B` : '\u200B',
            value: playerStatus[i] !== '' ? playerStatus[i] : client.intlGet(guildId, 'empty'),
            inline: true,
        });
    }

    return getEmbed({
        title: `${tracker.name}`,
        color: Constants.COLOR_DEFAULT,
        description: description,
        thumbnail: `${tracker.img}`,
        footer: { text: `${tracker.title}` },
        fields: fields,
        timestamp: true,
    });
}

export function getSmartAlarmEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];
    const grid = Utils.getGridSuffix(entity.location);
    let description = `**ID**: \`${entityId}\`\n`;
    description += `**${client.intlGet(guildId, 'lastTrigger')}:** `;

    if (entity.lastTrigger !== null) {
        const lastTriggerDate = new Date(entity.lastTrigger * 1000);
        const timeSinceTriggerSeconds = Math.floor((new Date().getTime() - lastTriggerDate.getTime()) / 1000);
        const time = secondsToFullScale(timeSinceTriggerSeconds);
        description += `${time}`;
    }

    return getEmbed({
        title: `${entity.name}${grid}`,
        color: entity.active ? Constants.COLOR_ACTIVE : Constants.COLOR_DEFAULT,
        description: description,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        fields: [
            {
                name: client.intlGet(guildId, 'message'),
                value: `\`${entity.message}\``,
                inline: true,
            },
            {
                name: client.intlGet(guildId, 'customCommand'),
                value: `\`${instance.generalSettings.prefix}${entity.command}\``,
                inline: false,
            },
        ],
        timestamp: true,
    });
}

export function getStorageMonitorEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const rustplus = client.rustplusInstances[guildId];
    const grid = Utils.getGridSuffix(entity.location);

    let description = `**ID** \`${entityId}\``;

    if (!rustplus) {
        return getEmbed({
            title: `${entity.name}${grid}`,
            color: Constants.COLOR_DEFAULT,
            description: `${description}\n${client.intlGet(guildId, 'statusNotConnectedToServer')}`,
            thumbnail: `attachment://${entity.image}`,
            footer: { text: `${entity.server}` },
            timestamp: true,
        });
    }

    if (rustplus && rustplus.storageMonitors[entityId].capacity === 0) {
        return getEmbed({
            title: `${entity.name}${grid}`,
            color: Constants.COLOR_DEFAULT,
            description: `${description}\n${client.intlGet(guildId, 'statusNotElectronicallyConnected')}`,
            thumbnail: `attachment://${entity.image}`,
            footer: { text: `${entity.server}` },
            timestamp: true,
        });
    }

    description +=
        `\n**${client.intlGet(guildId, 'type')}** ` +
        `\`${entity.type !== null ? client.intlGet(guildId, entity.type) : client.intlGet(guildId, 'unknown')}\``;

    const items = rustplus.storageMonitors[entityId].items;
    const expiry = rustplus.storageMonitors[entityId].expiry;
    const capacity = rustplus.storageMonitors[entityId].capacity;

    description += `\n**${client.intlGet(guildId, 'slots')}** `;
    description += `\`(${items.length}/${capacity})\``;

    if (entity.type === 'toolCupboard') {
        let seconds = 0;
        if (expiry !== 0) {
            seconds = (new Date(expiry * 1000).getTime() - new Date().getTime()) / 1000;
        }

        let upkeep = null;
        if (seconds === 0) {
            upkeep = `:warning:\`${client.intlGet(guildId, 'decayingCap')}\`:warning:`;
            instance.serverList[serverId].storageMonitors[entityId].upkeep = client.intlGet(guildId, 'decayingCap');
        } else {
            let upkeepTime = secondsToFullScale(seconds);
            upkeep = `\`${upkeepTime}\``;
            instance.serverList[serverId].storageMonitors[entityId].upkeep = `${upkeepTime}`;
        }
        description += `\n**${client.intlGet(guildId, 'upkeep')}** ${upkeep}`;
        client.setInstance(guildId, instance);
    }

    let itemName = '',
        itemQuantity = '',
        storageItems = new Object();
    for (const item of items) {
        if (Object.hasOwn(storageItems, item.itemId)) {
            storageItems[item.itemId] += item.quantity;
        } else {
            storageItems[item.itemId] = item.quantity;
        }
    }

    for (const [id, quantity] of Object.entries(storageItems)) {
        itemName += `\`${(client.items).getName(id)}\`\n`;
        itemQuantity += `\`${quantity}\`\n`;
    }

    itemName = Utils.orEmpty(client, guildId, itemName);
    itemQuantity = Utils.orEmpty(client, guildId, itemQuantity);

    return getEmbed({
        title: `${entity.name}${grid}`,
        color: Constants.COLOR_DEFAULT,
        description: description,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        fields: [
            { name: client.intlGet(guildId, 'item'), value: itemName, inline: true },
            { name: client.intlGet(guildId, 'quantity'), value: itemQuantity, inline: true },
        ],
        timestamp: true,
    });
}

export function getSmartSwitchGroupEmbed(guildId, serverId, groupId) {
    const instance = client.getInstance(guildId);
    const group = instance.serverList[serverId].switchGroups[groupId];

    let switchName = '',
        switchId = '',
        switchActive = '';
    for (const groupSwitchId of group.switches) {
        if (Object.hasOwn(instance.serverList[serverId].switches, groupSwitchId)) {
            const sw = instance.serverList[serverId].switches[groupSwitchId];
            const active = sw.active;
            switchName += `${sw.name}${sw.location !== null ? ` ${sw.location}` : ''}\n`;
            switchId += `${groupSwitchId}\n`;
            if (sw.reachable) {
                switchActive += `${active ? Constants.ONLINE_EMOJI : Constants.OFFLINE_EMOJI}\n`;
            } else {
                switchActive += `${Constants.NOT_FOUND_EMOJI}\n`;
            }
        } else {
            instance.serverList[serverId].switchGroups[groupId].switches = instance.serverList[serverId].switchGroups[
                groupId
            ].switches.filter((e) => e !== groupSwitchId);
        }
    }
    client.setInstance(guildId, instance);

    if (switchName === '') switchName = client.intlGet(guildId, 'none');
    if (switchId === '') switchId = client.intlGet(guildId, 'none');
    if (switchActive === '') switchActive = client.intlGet(guildId, 'none');

    return getEmbed({
        title: group.name,
        color: Constants.COLOR_DEFAULT,
        description: `**ID**: \`${groupId}\``,
        thumbnail: `attachment://${group.image}`,
        footer: { text: `${instance.serverList[serverId].title}` },
        fields: [
            {
                name: client.intlGet(guildId, 'customCommand'),
                value: `\`${instance.generalSettings.prefix}${group.command}\``,
                inline: false,
            },
            { name: client.intlGet(guildId, 'switches'), value: switchName, inline: true },
            { name: 'ID', value: switchId, inline: true },
            { name: client.intlGet(guildId, 'status'), value: switchActive, inline: true },
        ],

        timestamp: true,
    });
}

export function getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, type) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId][type][entityId];
    const grid = Utils.getGridSuffix(entity.location);

    return getEmbed({
        title: `${entity.name}${grid}`,
        color: Constants.COLOR_INACTIVE,
        description:
            `**ID**: \`${entityId}\`\n` + `${client.intlGet(guildId, 'statusNotFound')} ${Constants.NOT_FOUND_EMOJI}`,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
    });
}

export function getStorageMonitorRecycleEmbed(guildId, serverId, entityId, items) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const grid = Utils.getGridSuffix(entity.location);

    let itemName = '',
        itemQuantity = '';
    for (const item of items['recycler']) {
        itemName += `\`${(client.items).getName(item.itemId)}\`\n`;
        itemQuantity += `\`${item.quantity}\`\n`;
    }

    const embed = getEmbed({
        title: `${client.intlGet(guildId, 'resultRecycling')}:`,
        color: Constants.COLOR_DEFAULT,
        thumbnail: 'attachment://recycler.png',
        footer: { text: `${entity.server} | ${client.intlGet(guildId, 'messageDeletedIn30')}` },
        description: `**${client.intlGet(guildId, 'name')}** ` + `\`${entity.name}${grid}\`\n**ID** \`${entityId}\``,
    });

    itemName = Utils.orEmpty(client, guildId, itemName);
    itemQuantity = Utils.orEmpty(client, guildId, itemQuantity);

    embed.addFields(
        { name: client.intlGet(guildId, 'item'), value: itemName, inline: true },
        { name: client.intlGet(guildId, 'quantity'), value: itemQuantity, inline: true },
    );

    return embed;
}

export function getDecayingNotificationEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const grid = Utils.getGridSuffix(entity.location);

    return getEmbed({
        title: client.intlGet(guildId, 'isDecaying', {
            device: `${entity.name}${grid}`,
        }),
        color: Constants.COLOR_INACTIVE,
        description: `**ID** \`${entityId}\``,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        timestamp: true,
    });
}

export function getStorageMonitorDisconnectNotificationEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const grid = Utils.getGridSuffix(entity.location);

    return getEmbed({
        title: client.intlGet(guildId, 'isNoLongerConnected', {
            device: `${entity.name}${grid}`,
        }),
        color: Constants.COLOR_INACTIVE,
        description: `**ID** \`${entityId}\``,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        timestamp: true,
    });
}

export async function getStorageMonitorNotFoundEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    const entity = server.storageMonitors[entityId];
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const user = await DiscordTools.getUserById(guildId, credentials[server.steamId].discord_user_id);
    const grid = Utils.getGridSuffix(entity.location);

    return getEmbed({
        title: client.intlGet(guildId, 'smartDeviceNotFound', {
            device: `${entity.name}${grid}`,
            user: user.user.username,
        }),
        color: Constants.COLOR_INACTIVE,
        description: `**ID** \`${entityId}\``,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        timestamp: true,
    });
}

export async function getSmartSwitchNotFoundEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    const entity = instance.serverList[serverId].switches[entityId];
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const user = await DiscordTools.getUserById(guildId, credentials[server.steamId].discord_user_id);
    const grid = Utils.getGridSuffix(entity.location);

    return getEmbed({
        title: client.intlGet(guildId, 'smartDeviceNotFound', {
            device: `${entity.name}${grid}`,
            user: user.user.username,
        }),
        color: Constants.COLOR_INACTIVE,
        description: `**ID** \`${entityId}\``,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        timestamp: true,
    });
}

export async function getSmartAlarmNotFoundEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    const entity = server.alarms[entityId];
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    const user = await DiscordTools.getUserById(guildId, credentials[server.steamId].discord_user_id);
    const grid = Utils.getGridSuffix(entity.location);

    return getEmbed({
        title: client.intlGet(guildId, 'smartDeviceNotFound', {
            device: `${entity.name}${grid}`,
            user: user.user.username,
        }),
        color: Constants.COLOR_INACTIVE,
        description: `**ID** \`${entityId}\``,
        thumbnail: `attachment://${entity.image}`,
        footer: { text: `${entity.server}` },
        timestamp: true,
    });
}

export function getNewsEmbed(guildId, data) {
    return getEmbed({
        title: `${client.intlGet(guildId, 'newsCap')}: ${data.title}`,
        color: Constants.COLOR_DEFAULT,
        description: `${data.message}`,
        thumbnail: Constants.DEFAULT_SERVER_IMG,
        timestamp: true,
    });
}

export function getTeamLoginEmbed(guildId, body, png) {
    return getEmbed({
        color: Constants.COLOR_ACTIVE,
        timestamp: true,
        footer: { text: body.name },
        author: {
            name: client.intlGet(guildId, 'userJustConnected', { name: body.targetName }),
            iconURL: png !== null ? png : Constants.DEFAULT_SERVER_IMG,
            url: `${Constants.STEAM_PROFILES_URL}${body.targetId}`,
        },
    });
}

export function getPlayerDeathEmbed(data, body, png) {
    return getEmbed({
        color: Constants.COLOR_INACTIVE,
        thumbnail: png,
        title: data.title,
        timestamp: true,
        footer: { text: body.name },
        url: body.targetId !== '' ? `${Constants.STEAM_PROFILES_URL}${body.targetId}` : '',
    });
}

export function getAlarmRaidAlarmEmbed(data, body) {
    return getEmbed({
        color: Constants.COLOR_ACTIVE,
        timestamp: true,
        footer: { text: body.name },
        title: data.title,
        description: data.message,
        thumbnail: body.img !== '' && isValidUrl(body.img) ? body.img : 'attachment://rocket.png',
    });
}

export function getAlarmEmbed(guildId, serverId, entityId) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];
    const grid = Utils.getGridSuffix(entity.location);

    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        thumbnail: `attachment://${entity.image}`,
        title: `${entity.name}${grid}`,
        footer: { text: entity.server },
        timestamp: true,
        fields: [
            { name: 'ID', value: `\`${entityId}\``, inline: true },
            { name: client.intlGet(guildId, 'message'), value: `\`${entity.message}\``, inline: true },
        ],
    });
}

export function getEventEmbed(guildId, serverId, text, image, color = Constants.COLOR_DEFAULT) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
        color: color,
        thumbnail: `attachment://${image}`,
        title: text,
        footer: { text: server.title, iconURL: server.img },
        timestamp: true,
    });
}

export function getActionInfoEmbed(color, str, footer = null, ephemeral = true) {
    return {
        embeds: [
            getEmbed({
                color: color === 0 ? Constants.COLOR_DEFAULT : Constants.COLOR_INACTIVE,
                description: `\`\`\`diff\n${color === 0 ? '+' : '-'} ${str}\n\`\`\``,
                footer: footer !== null ? { text: footer } : null,
            }),
        ],
        flags: ephemeral ? Discord.MessageFlags.Ephemeral : 0,
    };
}

export function getServerChangedStateEmbed(guildId, serverId, state) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
        color: state ? Constants.COLOR_INACTIVE : Constants.COLOR_ACTIVE,
        title: state ? client.intlGet(guildId, 'serverJustOffline') : client.intlGet(guildId, 'serverJustOnline'),
        thumbnail: server.img,
        timestamp: true,
        footer: { text: server.title },
    });
}

export function getServerWipeDetectedEmbed(guildId, serverId) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        title: client.intlGet(guildId, 'wipeDetected'),
        image: `attachment://${guildId}_map_full.png`,
        timestamp: true,
        footer: { text: server.title },
    });
}

export function getServerConnectionInvalidEmbed(guildId, serverId) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
        color: Constants.COLOR_INACTIVE,
        title: client.intlGet(guildId, 'serverInvalid'),
        thumbnail: server.img,
        timestamp: true,
        footer: { text: server.title },
    });
}

export function getActivityNotificationEmbed(guildId, serverId, color, text, steamId, png, title = null) {
    const instance = client.getInstance(guildId);
    const footerTitle = title !== null ? title : instance.serverList[serverId].title;
    return getEmbed({
        color: color,
        timestamp: true,
        footer: { text: footerTitle },
        author: {
            name: text,
            iconURL: png !== null ? png : Constants.DEFAULT_SERVER_IMG,
            url: `${Constants.STEAM_PROFILES_URL}${steamId}`,
        },
    });
}

export function getUpdateServerInformationEmbed(rustplus) {
    const guildId = rustplus.guildId;
    const instance = client.getInstance(guildId);

    const time = rustplus.getCommandTime(true);
    const timeLeftTitle = client.intlGet(rustplus.guildId, 'timeTill', {
        event: rustplus.time.isDay() ? Constants.NIGHT_EMOJI : Constants.DAY_EMOJI,
    });
    const playersFieldName = client.intlGet(guildId, 'players');
    const timeFieldName = client.intlGet(guildId, 'time');
    const wipeFieldName = client.intlGet(guildId, 'wipe');
    const mapSizeFieldName = client.intlGet(guildId, 'mapSize');
    const mapSeedFieldName = client.intlGet(guildId, 'mapSeed');
    const mapSaltFieldName = client.intlGet(guildId, 'mapSalt');
    const mapFieldName = client.intlGet(guildId, 'map');

    const embed = getEmbed({
        title: client.intlGet(guildId, 'serverInfo'),
        color: Constants.COLOR_DEFAULT,
        thumbnail: 'attachment://server_info_logo.png',
        footer: { text: instance.serverList[rustplus.serverId].title },
        fields: [
            { name: playersFieldName, value: `\`${rustplus.getCommandPop(true)}\``, inline: true },
            { name: timeFieldName, value: `\`${time[0]}\``, inline: true },
            { name: wipeFieldName, value: `\`${rustplus.getCommandWipe(true)}\``, inline: true },
        ],
        timestamp: true,
    });

    if (time[1] !== null) {
        embed.addFields(
            { name: timeLeftTitle, value: `\`${time[1]}\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
        );
    } else {
        embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
    }

    embed.addFields(
        { name: mapSizeFieldName, value: `\`${rustplus.info.mapSize}\``, inline: true },
        { name: mapSeedFieldName, value: `\`${rustplus.info.seed}\``, inline: true },
        { name: mapSaltFieldName, value: `\`${rustplus.info.salt}\``, inline: true },
        { name: mapFieldName, value: `\`${rustplus.info.map}\``, inline: true },
    );

    if (instance.serverList[rustplus.serverId].connect !== null) {
        embed.addFields({
            name: client.intlGet(guildId, 'connect'),
            value: `\`${instance.serverList[rustplus.serverId].connect}\``,
            inline: false,
        });
    }

    return embed;
}

export function getUpdateEventInformationEmbed(rustplus) {
    const guildId = rustplus.guildId;
    const instance = client.getInstance(guildId);

    const cargoshipFieldName = client.intlGet(guildId, 'cargoship');
    const patrolHelicopterFieldName = client.intlGet(guildId, 'patrolHelicopter');
    const smallOilRigFieldName = client.intlGet(guildId, 'smallOilRig');
    const largeOilRigFieldName = client.intlGet(guildId, 'largeOilRig');
    const chinook47FieldName = client.intlGet(guildId, 'chinook47');
    const travelingVendorFieldName = client.intlGet(guildId, 'travelingVendor');
    const deepSeaFieldName = client.intlGet(guildId, 'deepSea');

    const cargoShipMessage = rustplus.getCommandCargo(true);
    const patrolHelicopterMessage = rustplus.getCommandHeli(true);
    const smallOilMessage = rustplus.getCommandSmall(true);
    const largeOilMessage = rustplus.getCommandLarge(true);
    const ch47Message = rustplus.getCommandChinook(true);
    const travelingVendorMessage = rustplus.getCommandTravelingVendor(true);
    const deepSeaMessage = rustplus.getCommandDeepSea(true);

    return getEmbed({
        title: client.intlGet(guildId, 'eventInfo'),
        color: Constants.COLOR_DEFAULT,
        thumbnail: 'attachment://event_info_logo.png',
        description: client.intlGet(guildId, 'inGameEventInfo'),
        footer: { text: instance.serverList[rustplus.serverId].title },
        fields: [
            { name: cargoshipFieldName, value: `\`${cargoShipMessage}\``, inline: true },
            { name: patrolHelicopterFieldName, value: `\`${patrolHelicopterMessage}\``, inline: true },
            { name: smallOilRigFieldName, value: `\`${smallOilMessage}\``, inline: true },
            { name: largeOilRigFieldName, value: `\`${largeOilMessage}\``, inline: true },
            { name: chinook47FieldName, value: `\`${ch47Message}\``, inline: true },
            { name: travelingVendorFieldName, value: `\`${travelingVendorMessage}\``, inline: true },
            { name: deepSeaFieldName, value: `\`${deepSeaMessage}\``, inline: true },
        ],
        timestamp: true,
    });
}

export function getUpdateTeamInformationEmbed(rustplus) {
    const guildId = rustplus.guildId;
    const instance = client.getInstance(guildId);

    const title = client.intlGet(guildId, 'teamMemberInfo');
    const teamMemberFieldName = client.intlGet(guildId, 'teamMember');
    const statusFieldName = client.intlGet(guildId, 'status');
    const locationFieldName = client.intlGet(guildId, 'location');
    const footer = instance.serverList[rustplus.serverId].title;

    let totalCharacters =
        title.length + teamMemberFieldName.length + statusFieldName.length + locationFieldName.length + footer.length;
    let fieldIndex = 0;
    let teammateName = [''],
        teammateStatus = [''],
        teammateLocation = [''];
    let teammateNameCharacters = 0,
        teammateStatusCharacters = 0,
        teammateLocationCharacters = 0;
    for (const player of rustplus.team.players) {
        let name = player.name === '' ? '-' : `[${player.name}](${Constants.STEAM_PROFILES_URL}${player.steamId})`;
        name += player.teamLeader ? `${Constants.LEADER_EMOJI}\n` : '\n';
        let status = '';
        let location = player.isOnline || player.isAlive ? `${player.pos.string}\n` : '-\n';

        if (player.isOnline) {
            const isAfk = player.getAfkSeconds() >= Constants.AFK_TIME_SECONDS;
            const afkTime = player.getAfkTime('dhs');

            status += isAfk ? Constants.AFK_EMOJI : Constants.ONLINE_EMOJI;
            status += player.isAlive
                ? isAfk
                    ? Constants.SLEEPING_EMOJI
                    : Constants.ALIVE_EMOJI
                : Constants.DEAD_EMOJI;
            status += Object.keys(instance.serverListLite[rustplus.serverId]).includes(player.steamId)
                ? Constants.PAIRED_EMOJI
                : '';
            status += isAfk ? ` ${afkTime}\n` : '\n';
        } else {
            const offlineTime = player.getOfflineTime('s');
            status += Constants.OFFLINE_EMOJI;
            status += player.isAlive ? Constants.SLEEPING_EMOJI : Constants.DEAD_EMOJI;
            status += Object.keys(instance.serverListLite[rustplus.serverId]).includes(player.steamId)
                ? Constants.PAIRED_EMOJI
                : '';
            status += offlineTime !== null ? offlineTime : '';
            status += '\n';
        }

        if (totalCharacters + (name.length + status.length + location.length) >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
            break;
        }

        if (
            teammateNameCharacters + name.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
            teammateStatusCharacters + status.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
            teammateLocationCharacters + location.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS
        ) {
            fieldIndex += 1;

            teammateName.push('');
            teammateStatus.push('');
            teammateLocation.push('');

            teammateNameCharacters = 0;
            teammateStatusCharacters = 0;
            teammateLocationCharacters = 0;
        }

        teammateNameCharacters += name.length;
        teammateStatusCharacters += status.length;
        teammateLocationCharacters += location.length;

        totalCharacters += name.length + status.length + location.length;

        teammateName[fieldIndex] += name;
        teammateStatus[fieldIndex] += status;
        teammateLocation[fieldIndex] += location;
    }

    const fields = [];
    for (let i = 0; i < fieldIndex + 1; i++) {
        fields.push({
            name: i === 0 ? teamMemberFieldName : '\u200B',
            value: teammateName[i] !== '' ? teammateName[i] : client.intlGet(guildId, 'empty'),
            inline: true,
        });
        fields.push({
            name: i === 0 ? statusFieldName : '\u200B',
            value: teammateStatus[i] !== '' ? teammateStatus[i] : client.intlGet(guildId, 'empty'),
            inline: true,
        });
        fields.push({
            name: i === 0 ? locationFieldName : '\u200B',
            value: teammateLocation[i] !== '' ? teammateLocation[i] : client.intlGet(guildId, 'empty'),
            inline: true,
        });
    }

    return getEmbed({
        title: title,
        color: Constants.COLOR_DEFAULT,
        thumbnail: 'attachment://team_info_logo.png',
        footer: { text: footer },
        fields: fields,
        timestamp: true,
    });
}

export function getUpdateBattlemetricsOnlinePlayersInformationEmbed(rustplus, battlemetricsId) {
    const bmInstance = client.battlemetricsInstances[battlemetricsId];
    const guildId = rustplus.guildId;

    const playerIds = bmInstance.getOnlinePlayerIdsOrderedByTime();

    let totalCharacters = 0;
    let fieldCharacters = 0;

    const title = client.intlGet(guildId, 'battlemetricsOnlinePlayers');
    const footer = { text: bmInstance.server_name };

    totalCharacters += title.length;
    totalCharacters += bmInstance.server_name.length;
    totalCharacters += client.intlGet(guildId, 'andMorePlayers', { number: 100 }).length;
    totalCharacters += `${client.intlGet(guildId, 'players')}`.length;

    const fields = [''];
    let fieldIndex = 0;
    let isEmbedFull = false;
    let playerCounter = 0;
    for (const playerId of playerIds) {
        playerCounter += 1;

        const status = bmInstance.players[playerId]['status'];
        const timeResult = status ? bmInstance.getOnlineTime(playerId) : bmInstance.getOfflineTime(playerId);
        const time = timeResult !== null ? timeResult[1] : '';

        let playerStr = status ? Constants.ONLINE_EMOJI : Constants.OFFLINE_EMOJI;
        playerStr += ` [${time}] `;

        const nameMaxLength = Constants.EMBED_FIELD_MAX_WIDTH_LENGTH_3 - (3 + time.length);

        let name = bmInstance.players[playerId]['name'].replace('[', '(').replace(']', ')');
        name = name.length <= nameMaxLength ? name : name.substring(0, nameMaxLength - 2) + '..';

        playerStr += `[${name}](${Constants.BATTLEMETRICS_PROFILE_URL + `${playerId}`})\n`;

        if (totalCharacters + playerStr.length >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
            isEmbedFull = true;
            break;
        }

        if (fieldCharacters + playerStr.length >= Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {
            fieldCharacters = 0;
            fieldIndex += 1;
            fields.push('');
        }

        fields[fieldIndex] += playerStr;
        totalCharacters += playerStr.length;
        fieldCharacters += playerStr.length;
    }

    const embed = getEmbed({
        title: title,
        color: Constants.COLOR_DEFAULT,
        footer: footer,
        timestamp: true,
    });

    if (isEmbedFull) {
        embed.setDescription(
            client.intlGet(guildId, 'andMorePlayers', {
                number: playerIds.length - playerCounter,
            }),
        );
    }

    let fieldCounter = 0;
    for (const field of fields) {
        embed.addFields({
            name: fieldCounter === 0 ? client.intlGet(guildId, 'players') : '\u200B',
            value: field === '' ? '\u200B' : field,
            inline: true,
        });
        fieldCounter += 1;
    }

    return embed;
}

export function getDiscordCommandResponseEmbed(rustplus, response) {
    const instance = client.getInstance(rustplus.guildId);

    let string = '';
    if (Array.isArray(response)) {
        for (const str of response) {
            string += `${str}\n`;
        }
    } else {
        string = response;
    }

    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        description: `**${string}**`,
        footer: { text: `${instance.serverList[rustplus.serverId].title}` },
    });
}

export async function getCredentialsShowEmbed(guildId) {
    const credentials = InstanceUtils.readCredentialsFile(guildId);
    let names = '';
    let steamIds = '';
    let hoster = '';

    for (const credential in credentials) {
        if (credential === 'hoster') continue;

        const user = await DiscordTools.getUserById(guildId, credentials[credential].discord_user_id);
        names += `${user.user.username}\n`;
        steamIds += `${credential}\n`;
        hoster += `${credential === credentials.hoster ? `${Constants.LEADER_EMOJI}\n` : '\u200B\n'}`;
    }

    names = Utils.orEmpty(client, guildId, names);
    steamIds = Utils.orEmpty(client, guildId, steamIds);
    hoster = Utils.orEmpty(client, guildId, hoster);

    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        title: client.intlGet(guildId, 'fcmCredentials'),
        fields: [
            { name: client.intlGet(guildId, 'name'), value: names, inline: true },
            { name: 'SteamID', value: steamIds, inline: true },
            { name: client.intlGet(guildId, 'hoster'), value: hoster, inline: true },
        ],
    });
}

export function getItemAvailableVendingMachineEmbed(guildId, serverId, str) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        footer: { text: server.title },
        author: {
            name: str,
        },
    });
}

export function getUserSendEmbed(guildId, serverId, sender, str) {
    const instance = client.getInstance(guildId);
    const server = instance.serverList[serverId];
    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        footer: { text: server.title },
        description: `**${sender}**: ${str}`,
    });
}

export function getHelpEmbed(guildId) {
    const repository = 'https://github.com/rust-sense/bot';
    const credentials = `${repository}/blob/develop/docs/credentials.md`;
    const pairServer = `${repository}/blob/develop/docs/pair_and_connect_to_server.md`;
    const commands = `${repository}/blob/develop/docs/commands.md`;

    const description =
        `→ [${client.intlGet(guildId, 'commandsHelpHowToCredentials')}](${credentials})\n` +
        `→ [${client.intlGet(guildId, 'commandsHelpHowToPairServer')}](${pairServer})\n` +
        `→ [${client.intlGet(guildId, 'commandsHelpCommandList')}](${commands})`;

    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        title: `rust-sense Help`,
        description: description,
    });
}

export function getCctvEmbed(guildId, monument, cctvCodes, dynamic) {
    let code = '';
    for (const cctvCode of cctvCodes) {
        code += `${cctvCode} \n`;
    }
    if (dynamic) {
        code += client.intlGet(guildId, 'asteriskCctvDesc');
    }
    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        title: `${monument} CCTV ${client.intlGet(guildId, 'codes')}`,
        description: code,
    });
}

export function getUptimeEmbed(guildId, uptime) {
    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        title: uptime,
    });
}

export function getVoiceEmbed(guildId, state) {
    return getEmbed({
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        title: state,
    });
}

export function getCraftEmbed(guildId, craftDetails, quantity) {
    let title = '';
    let description = '';

    if (quantity === 1) {
        title = `${craftDetails[1].name}`;
        description += `__**${client.intlGet(guildId, 'time')}:**__ ${craftDetails[2].timeString}`;
    } else {
        title = `${craftDetails[1].name} x${quantity}`;
        const time = secondsToFullScale(craftDetails[2].time * quantity, '', true);
        description += `__**${client.intlGet(guildId, 'time')}:**__ ${time}`;
    }

    let items = '',
        quantities = '';
    for (const item of craftDetails[2].ingredients) {
        const itemName = client.items.getName(item.id);
        items += `${itemName}\n`;
        quantities += `${item.quantity * quantity}\n`;
    }

    return getEmbed({
        title: title,
        description: description,
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        fields: [
            { name: client.intlGet(guildId, 'quantity'), value: items, inline: true },
            { name: client.intlGet(guildId, 'hoster'), value: quantities, inline: true },
        ],
    });
}

export function getResearchEmbed(guildId, researchDetails) {
    let typeString = '',
        scrapString = '';
    if (researchDetails[2].researchTable !== null) {
        typeString += `${client.intlGet(guildId, 'researchTable')}\n`;
        scrapString += `${researchDetails[2].researchTable}\n`;
    }
    if (researchDetails[2].workbench !== null) {
        typeString += `${(client.items).getName(researchDetails[2].workbench.type)}\n`;
        const scrap = researchDetails[2].workbench.scrap;
        const totalScrap = researchDetails[2].workbench.totalScrap;
        scrapString += `${scrap} (${client.intlGet(guildId, 'total')} ${totalScrap})`;
    }

    return getEmbed({
        title: `${researchDetails[1].name}`,
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        fields: [
            { name: client.intlGet(guildId, 'type'), value: typeString, inline: true },
            { name: client.intlGet(guildId, 'scrap'), value: scrapString, inline: true },
        ],
    });
}

export function getRecycleEmbed(guildId, recycleDetails, quantity, recyclerType) {
    let title = quantity === 1 ? `${recycleDetails[1].name}` : `${recycleDetails[1].name} x${quantity}`;
    title += ` (${client.intlGet(guildId, recyclerType)})`;

    const recycleData = client.rustlabs.getRecycleDataFromArray([
        { itemId: recycleDetails[0], quantity: quantity, itemIsBlueprint: false },
    ]);

    let items0 = '',
        quantities0 = '';
    for (const item of recycleDetails[2][recyclerType]['yield']) {
        items0 += `${(client.items).getName(item.id)}\n`;
        quantities0 += item.probability !== 1 ? `${Math.floor(item.probability * 100)}%\n` : `${item.quantity}\n`;
    }

    let items1 = '',
        quantities1 = '';
    for (const item of recycleData[recyclerType]) {
        items1 += `${(client.items).getName(item.itemId)}\n`;
        quantities1 += `${item.quantity}\n`;
    }

    return getEmbed({
        title: title,
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        fields: [
            { name: client.intlGet(guildId, 'yield'), value: items0, inline: true },
            { name: '\u200B', value: quantities0, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: client.intlGet(guildId, 'calculated'), value: items1, inline: true },
            { name: '\u200B', value: quantities1, inline: true },
        ],
    });
}

export function getBattlemetricsEventEmbed(guildId, battlemetricsId, title, description, fields = null) {
    const instance = client.getInstance(guildId);
    const bmInstance = client.battlemetricsInstances[battlemetricsId];

    const serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;

    let thumbnail = '';
    if (Object.hasOwn(instance.serverList, serverId)) {
        thumbnail = instance.serverList[serverId].img;
    }
    const embed = getEmbed({
        title: title,
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
        thumbnail: thumbnail,
        footer: { text: bmInstance.server_name },
    });

    if (fields !== null) {
        embed.addFields(fields);
    }

    if (description !== '') {
        embed.setDescription(description);
    }

    return embed;
}

export function getItemEmbed(guildId, itemName, itemId, type) {
    const title = `${itemName} (${itemId})`;

    const fields = [];
    const embed = getEmbed({
        title: title,
        color: Constants.COLOR_DEFAULT,
        timestamp: true,
    });

    const decayDetails =
        type === 'items' ? client.rustlabs.getDecayDetailsById(itemId) : client.rustlabs.getDecayDetailsByName(itemId);
    if (decayDetails !== null) {
        const details = decayDetails[3];
        const hp = details.hpString;
        if (hp !== null) {
            fields.push({
                name: client.intlGet(guildId, 'hp'),
                value: hp,
                inline: true,
            });
        }

        let decayString = '';
        const decay = details.decayString;
        if (decay !== null) {
            decayString += `${decay}\n`;
        }

        const decayOutside = details.decayOutsideString;
        if (decayOutside !== null) {
            decayString += `${client.intlGet(guildId, 'outside')}: ${decayOutside}\n`;
        }

        const decayInside = details.decayInsideString;
        if (decayInside !== null) {
            decayString += `${client.intlGet(guildId, 'inside')}: ${decayInside}\n`;
        }

        const decayUnderwater = details.decayUnderwaterString;
        if (decayUnderwater !== null) {
            decayString += `${client.intlGet(guildId, 'underwater')}: ${decayUnderwater}\n`;
        }

        if (decayString !== '') {
            fields.push({
                name: client.intlGet(guildId, 'decay'),
                value: decayString,
                inline: true,
            });
        }
    }

    const despawnDetails = type === 'items' ? client.rustlabs.getDespawnDetailsById(itemId) : null;
    if (despawnDetails !== null) {
        const details = despawnDetails[2];
        fields.push({
            name: client.intlGet(guildId, 'despawnTime'),
            value: details.timeString,
            inline: true,
        });
    }

    const stackDetails = type === 'items' ? client.rustlabs.getStackDetailsById(itemId) : null;
    if (stackDetails !== null) {
        const details = stackDetails[2];
        fields.push({
            name: client.intlGet(guildId, 'stackSize'),
            value: details.quantity,
            inline: true,
        });
    }

    const upkeepDetails =
        type === 'items'
            ? client.rustlabs.getUpkeepDetailsById(itemId)
            : client.rustlabs.getUpkeepDetailsByName(itemId);
    if (upkeepDetails !== null) {
        const details = upkeepDetails[3];

        let upkeepString = '';
        for (const item of details) {
            const name = client.items.getName(item.id);
            const quantity = item.quantity;
            upkeepString += `${quantity} ${name}\n`;
        }

        fields.push({
            name: client.intlGet(guildId, 'upkeep'),
            value: upkeepString,
            inline: true,
        });
    }

    const craftDetails = type === 'items' ? client.rustlabs.getCraftDetailsById(itemId) : null;
    if (craftDetails !== null) {
        const details = craftDetails[2];
        let workbenchString = '';
        if (details.workbench !== null) {
            const workbenchShortname = client.items.getShortName(details.workbench);
            switch (workbenchShortname) {
                case 'workbench1':
                    {
                        workbenchString = ' (T1)';
                    }
                    break;

                case 'workbench2':
                    {
                        workbenchString = ' (T2)';
                    }
                    break;

                case 'workbench3':
                    {
                        workbenchString = ' (T3)';
                    }
                    break;
            }
        }

        let craftString = '';

        for (const ingredient of details.ingredients) {
            const amount = `${ingredient.quantity}x`;
            const name = client.items.getName(ingredient.id);
            craftString += `${amount} ${name}\n`;
        }

        if (craftString !== '') {
            fields.push({
                name: client.intlGet(guildId, 'craft') + workbenchString,
                value: craftString,
                inline: true,
            });
        }
    }

    const recycleDetails = type === 'items' ? client.rustlabs.getRecycleDetailsById(itemId) : null;
    if (recycleDetails !== null) {
        const details = recycleDetails[2]['recycler']['yield'];

        let recycleString = '';
        for (const recycleItem of details) {
            const name = client.items.getName(recycleItem.id);
            const quantityProbability =
                recycleItem.probability !== 1
                    ? `${Math.floor(recycleItem.probability * 100)}%`
                    : `${recycleItem.quantity}x`;
            recycleString += `${quantityProbability} ${name}\n`;
        }

        if (recycleString !== '') {
            fields.push({
                name: client.intlGet(guildId, 'recycle'),
                value: recycleString,
                inline: true,
            });
        }
    }

    const researchDetails = type === 'items' ? client.rustlabs.getResearchDetailsById(itemId) : null;
    if (researchDetails !== null) {
        const details = researchDetails[2];
        let workbenchString = '';
        if (details.workbench !== null) {
            const workbenchShortname = client.items.getShortName(details.workbench.type);
            switch (workbenchShortname) {
                case 'workbench1':
                    {
                        workbenchString = 'T1: ';
                    }
                    break;

                case 'workbench2':
                    {
                        workbenchString = 'T2: ';
                    }
                    break;

                case 'workbench3':
                    {
                        workbenchString = 'T3: ';
                    }
                    break;
            }
            workbenchString += `${details.workbench.scrap} (${details.workbench.totalScrap})\n`;
        }

        let researchTableString = '';
        if (details.researchTable !== null) {
            researchTableString = `${client.intlGet(guildId, 'researchTable')}: ${details.researchTable}\n`;
        }

        const researchString = `${workbenchString}${researchTableString}`;

        if (researchString !== '') {
            fields.push({
                name: client.intlGet(guildId, 'research'),
                value: researchString,
                inline: true,
            });
        }
    }

    if (fields.length !== 0) {
        embed.setFields(...fields);
    }

    return embed;
}
