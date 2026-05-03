import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as Constants from '../domain/constants.js';
import * as Scrape from '../infrastructure/scrape.js';
import { getPersistenceCache } from '../persistence/index.js';
import type DiscordBot from '../structures/DiscordBot.js';

export async function syncBattlemetrics(client: DiscordBot, firstTime = false) {
    const searchSteamProfiles = client.battlemetricsIntervalCounter === 0 ? true : false;
    const calledSteamProfiles = new Object();

    if (!firstTime) await client.updateBattlemetricsInstances();

    for (const guildItem of client.guilds.cache) {
        const guildId = guildItem[0];
        const instance = await getPersistenceCache().readGuildState(guildId);
        const rustplus = client.rustplusInstances[guildId];

        if (!firstTime) await handleBattlemetricsChanges(client, guildId);

        /* Update information channel battlemetrics players */
        const bmId = instance.activeServer !== null ? instance.serverList[instance.activeServer].battlemetricsId : null;
        let condition = instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers;
        condition = condition && instance.activeServer !== null;
        condition = condition && bmId !== null;
        condition = condition && Object.hasOwn(client.battlemetricsInstances, bmId);
        condition = condition && rustplus && rustplus.isOperational;

        if (condition) {
            await DiscordMessages.sendUpdateBattlemetricsOnlinePlayersInformationMessage(rustplus, bmId);
        } else {
            if (instance.informationMessageId.battlemetricsPlayers !== null) {
                await DiscordTools.deleteMessageById(
                    guildId,
                    instance.channelId.information,
                    instance.informationMessageId.battlemetricsPlayers,
                );

                instance.informationMessageId.battlemetricsPlayers = null;
                await getPersistenceCache().saveGuildStateChanges(guildId, instance);
            }
        }

        for (const [trackerId, content] of Object.entries(instance.trackers) as [string, any][]) {
            const battlemetricsId = content.battlemetricsId;
            const bmInstance = client.battlemetricsInstances[battlemetricsId];

            if (!bmInstance || !bmInstance.lastUpdateSuccessful) continue;

            if (firstTime || searchSteamProfiles) {
                for (const player of content.players) {
                    if (player.steamId === null) continue;

                    let name = null;
                    if (Object.hasOwn(calledSteamProfiles, player.steamId)) {
                        name = calledSteamProfiles[player.steamId];
                    } else {
                        name = await Scrape.scrapeSteamProfileName(client, player.steamId);
                        calledSteamProfiles[player.steamId] = name;
                    }

                    if (name === null) continue;

                    name = (content.clanTag !== '' ? `${content.clanTag} ` : '') + `${name}`;

                    if (player.name !== name) {
                        await trackerNewNameDetected(client, guildId, trackerId, battlemetricsId, player.name, name);

                        const newPlayerId = Object.keys(bmInstance.players).find(
                            (e) => bmInstance.players[e]['name'] === name,
                        );
                        player.playerId = newPlayerId ? newPlayerId : null;
                        player.name = name;
                    }
                }

                await getPersistenceCache().saveGuildStateChanges(guildId, instance);

                if (firstTime) {
                    await DiscordMessages.sendTrackerMessage(guildId, trackerId);
                    continue;
                }
            }

            const trackerPlayerIds = content.players.map((e) => e.playerId);

            /* Check if Player just changed name */
            for (const player of bmInstance.nameChangedPlayers.filter((e) => trackerPlayerIds.includes(e.id))) {
                for (const playerT of content.players) {
                    if (playerT.playerId !== player.id) continue;

                    await trackerNewNameDetected(client, guildId, trackerId, battlemetricsId, player.from, player.to);
                }
            }

            /* Check if Player just came online */
            for (const playerId of trackerPlayerIds.filter((e) => bmInstance.newPlayers.includes(e))) {
                for (const player of content.players) {
                    if (player.playerId !== playerId) continue;

                    const str = client.intlGet(guildId, 'playerJustConnectedTracker', {
                        name: player.name,
                        tracker: content.name,
                    });
                    await DiscordMessages.sendActivityNotificationMessage(
                        guildId,
                        content.serverId,
                        Constants.COLOR_ACTIVE,
                        str,
                        null,
                        content.title,
                        content.everyone,
                    );
                    if (rustplus && rustplus.serverId === content.serverId && content.inGame) {
                        rustplus.sendInGameMessage(str);
                    }
                }
            }

            /* Check if Player just came online */
            for (const playerId of trackerPlayerIds.filter((e) => bmInstance.loginPlayers.includes(e))) {
                for (const player of content.players) {
                    if (player.playerId !== playerId) continue;

                    const str = client.intlGet(guildId, 'playerJustConnectedTracker', {
                        name: player.name,
                        tracker: content.name,
                    });
                    await DiscordMessages.sendActivityNotificationMessage(
                        guildId,
                        content.serverId,
                        Constants.COLOR_ACTIVE,
                        str,
                        null,
                        content.title,
                        content.everyone,
                    );
                    if (rustplus && rustplus.serverId === content.serverId && content.inGame) {
                        rustplus.sendInGameMessage(str);
                    }
                }
            }

            /* Check if Player just went offline */
            for (const playerId of trackerPlayerIds.filter((e) => bmInstance.logoutPlayers.includes(e))) {
                for (const player of content.players) {
                    if (player.playerId !== playerId) continue;

                    const str = client.intlGet(guildId, 'playerJustDisconnectedTracker', {
                        name: player.name,
                        tracker: content.name,
                    });

                    await DiscordMessages.sendActivityNotificationMessage(
                        guildId,
                        content.serverId,
                        Constants.COLOR_INACTIVE,
                        str,
                        null,
                        content.title,
                        content.everyone,
                    );
                    if (rustplus && rustplus.serverId === content.serverId && content.inGame) {
                        rustplus.sendInGameMessage(str);
                    }
                }
            }

            await getPersistenceCache().saveGuildStateChanges(guildId, instance);

            await DiscordMessages.sendTrackerMessage(guildId, trackerId);
        }
    }

    if (client.battlemetricsIntervalCounter === 29) {
        client.battlemetricsIntervalCounter = 0;
    } else {
        client.battlemetricsIntervalCounter += 1;
    }
}

export async function handleBattlemetricsChanges(client: DiscordBot, guildId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const settings = instance.generalSettings;

    const activeServer = instance.activeServer;
    const server = instance.serverList[activeServer];
    const battlemetricsIdActiveServer = server ? server.battlemetricsId : null;

    const battlemetricsIds = [];
    if (
        battlemetricsIdActiveServer &&
        Object.hasOwn(client.battlemetricsInstances, battlemetricsIdActiveServer) &&
        client.battlemetricsInstances[battlemetricsIdActiveServer].lastUpdateSuccessful
    ) {
        battlemetricsIds.push(battlemetricsIdActiveServer);
    }

    for (const [trackerId, content] of Object.entries(instance.trackers) as [string, any][]) {
        const battlemetricsId = content.battlemetricsId;
        const bmInstance = client.battlemetricsInstances[battlemetricsId];

        if (!bmInstance || (bmInstance && !bmInstance.lastUpdateSuccessful)) continue;
        if (battlemetricsIds.includes(battlemetricsId)) continue;

        battlemetricsIds.push(battlemetricsId);
    }

    /* Go through each battlemetrics instance and notify changes */
    for (const battlemetricsId of battlemetricsIds) {
        const bmInstance = client.battlemetricsInstances[battlemetricsId];

        /* Server name changed? */
        if (settings.battlemetricsServerNameChanges && Object.hasOwn(bmInstance.serverEvaluation, 'server_name')) {
            const oldName = bmInstance.serverEvaluation['server_name'].from;
            const newName = bmInstance.serverEvaluation['server_name'].to;

            const title = client.intlGet(guildId, 'battlemetricsServerNameChanged');
            const description =
                `__**${client.intlGet(guildId, 'old')}:**__ ${oldName}\n` +
                `__**${client.intlGet(guildId, 'new')}:**__ ${newName}`;

            await DiscordMessages.sendBattlemetricsEventMessage(guildId, battlemetricsId, title, description);
        }

        /* Players whos name have changed */
        if (settings.battlemetricsGlobalNameChanges && bmInstance.nameChangedPlayers.length !== 0) {
            const title = client.intlGet(guildId, 'battlemetricsPlayersNameChanged');

            const oldNameFieldName = client.intlGet(guildId, 'old');
            const playerIdFieldName = client.intlGet(guildId, 'playerId');
            const newNameFieldName = client.intlGet(guildId, 'new');

            let totalCharacters = 50; /* Start of with 50 characters as a base. */

            let oldName = [''],
                playerId = [''],
                newName = [''];
            let oldNameCharacters = 0,
                playerIdCharacters = 0,
                newNameCharacters = 0;
            let fieldIndex = 0;
            let isEmbedFull = false;
            let playerCounter = 0;
            for (const player of bmInstance.nameChangedPlayers) {
                playerCounter += 1;
                const fieldRowMaxLength = Constants.EMBED_FIELD_MAX_WIDTH_LENGTH_3;

                let oldN = `${player.from}`;
                oldN = oldN.length <= fieldRowMaxLength ? oldN : oldN.substring(0, fieldRowMaxLength - 2) + '..';
                oldN += '\n';

                const id = `[${player.id}](${Constants.BATTLEMETRICS_PROFILE_URL + `${player.id}`})\n`;

                let newN = `${player.to}`;
                newN = newN.length <= fieldRowMaxLength ? newN : newN.substring(0, fieldRowMaxLength - 2) + '..';
                newN += '\n';

                if (totalCharacters + (oldN.length + id.length + newN.length) >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
                    isEmbedFull = true;
                    break;
                }

                if (
                    oldNameCharacters + oldN.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
                    playerIdCharacters + id.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
                    newNameCharacters + newN.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS
                ) {
                    fieldIndex += 1;

                    oldName.push('');
                    playerId.push('');
                    newName.push('');

                    oldNameCharacters = 0;
                    playerIdCharacters = 0;
                    newNameCharacters = 0;
                }

                oldNameCharacters += oldN.length;
                playerIdCharacters += id.length;
                newNameCharacters += newN.length;

                totalCharacters += oldN.length + id.length + newN.length;

                oldName[fieldIndex] += oldN;
                playerId[fieldIndex] += id;
                newName[fieldIndex] += newN;
            }

            let description = '';
            if (isEmbedFull) {
                description = client.intlGet(guildId, 'andMorePlayers', {
                    number: bmInstance.nameChangedPlayers.length - playerCounter,
                });
            }

            const fields = [];
            for (let i = 0; i < fieldIndex + 1; i++) {
                fields.push({
                    name: i === 0 ? oldNameFieldName : '\u200B',
                    value: oldName[i] !== '' ? oldName[i] : client.intlGet(guildId, 'empty'),
                    inline: true,
                });
                fields.push({
                    name: i === 0 ? playerIdFieldName : '\u200B',
                    value: playerId[i] !== '' ? playerId[i] : client.intlGet(guildId, 'empty'),
                    inline: true,
                });
                fields.push({
                    name: i === 0 ? newNameFieldName : '\u200B',
                    value: newName[i] !== '' ? newName[i] : client.intlGet(guildId, 'empty'),
                    inline: true,
                });
            }

            await DiscordMessages.sendBattlemetricsEventMessage(guildId, battlemetricsId, title, description, fields);
        }

        /* Players that just logged in */
        if (
            settings.battlemetricsGlobalLogin &&
            (bmInstance.loginPlayers.length !== 0 || bmInstance.newPlayers.length !== 0)
        ) {
            const playerIds = Array.from(new Set(bmInstance.loginPlayers.concat(bmInstance.newPlayers))) as string[];
            const title = client.intlGet(guildId, 'battlemetricsPlayersLogin');

            let totalCharacters = 50; /* Start of with 50 characters as a base. */
            let fieldCharacters = 0;

            const fields = [''];
            let fieldIndex = 0;
            let isEmbedFull = false;
            let playerCounter = 0;
            for (const playerId of playerIds) {
                playerCounter += 1;
                const name = bmInstance.players[playerId]['name'].replace('[', '(').replace(']', ')');
                const playerStr = `[${name}](${Constants.BATTLEMETRICS_PROFILE_URL + `${playerId}`})\n`;

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

            let description = '';
            if (isEmbedFull) {
                description = client.intlGet(guildId, 'andMorePlayers', {
                    number: playerIds.length - playerCounter,
                });
            }

            let fieldCounter = 0;
            const outPutFields = [];
            for (const field of fields) {
                outPutFields.push({
                    name: '\u200B',
                    value: field === '' ? '\u200B' : field,
                    inline: true,
                });
                fieldCounter += 1;
            }

            await DiscordMessages.sendBattlemetricsEventMessage(
                guildId,
                battlemetricsId,
                title,
                description,
                outPutFields,
            );
        }

        /* Players that just logged out */
        if (settings.battlemetricsGlobalLogout && bmInstance.logoutPlayers.length !== 0) {
            const title = client.intlGet(guildId, 'battlemetricsPlayersLogout');

            let totalCharacters = 50; /* Start of with 50 characters as a base. */
            let fieldCharacters = 0;

            const fields = [''];
            let fieldIndex = 0;
            let isEmbedFull = false;
            let playerCounter = 0;
            for (const playerId of bmInstance.logoutPlayers) {
                playerCounter += 1;
                const name = bmInstance.players[playerId]['name'].replace('[', '(').replace(']', ')');
                const playerStr = `[${name}](${Constants.BATTLEMETRICS_PROFILE_URL + `${playerId}`})\n`;

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

            let description = '';
            if (isEmbedFull) {
                description = client.intlGet(guildId, 'andMorePlayers', {
                    number: bmInstance.logoutPlayers.length - playerCounter,
                });
            }

            let fieldCounter = 0;
            const outPutFields = [];
            for (const field of fields) {
                outPutFields.push({
                    name: '\u200B',
                    value: field === '' ? '\u200B' : field,
                    inline: true,
                });
                fieldCounter += 1;
            }

            await DiscordMessages.sendBattlemetricsEventMessage(
                guildId,
                battlemetricsId,
                title,
                description,
                outPutFields,
            );
        }
    }
}

export async function trackerNewNameDetected(
    client: DiscordBot,
    guildId: string,
    trackerId: string,
    battlemetricsId: string,
    oldName: string,
    newName: string,
) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const trackerName = instance.trackers[trackerId].name;

    const title = client.intlGet(guildId, 'battlemetricsTrackerPlayerNameChanged');
    const description =
        `__**${client.intlGet(guildId, 'tracker')}:**__ ${trackerName}\n\n` +
        `__**${client.intlGet(guildId, 'old')}:**__ ${oldName}\n` +
        `__**${client.intlGet(guildId, 'new')}:**__ ${newName}`;

    await DiscordMessages.sendBattlemetricsEventMessage(
        guildId,
        battlemetricsId,
        title,
        description,
        null,
        instance.trackers[trackerId].everyone,
    );
}
