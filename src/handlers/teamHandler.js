const Constants = require('../util/constants');
const DiscordMessages = require('../discordTools/discordMessages');

module.exports = {
    handler: async function (rustplus, client, teamInfo) {
        /* Handle team changes */
        await module.exports.checkChanges(rustplus, client, teamInfo);
    },

    checkChanges: async function (rustplus, client, teamInfo) {
        let instance = client.getInstance(rustplus.guildId);
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;
        const server = instance.serverList[serverId];

        if (rustplus.team.isLeaderSteamIdChanged(teamInfo)) return;

        const newPlayers = rustplus.team.getNewPlayers(teamInfo);
        const leftPlayers = rustplus.team.getLeftPlayers(teamInfo);

        for (const steamId of leftPlayers) {
            const player = rustplus.team.getPlayer(steamId);

            const str = client.intlGet(guildId, 'playerLeftTheTeam', {
                name: getPlayerName(instance.generalSettings.teammateNameType, player),
            });

            await DiscordMessages.sendActivityNotificationMessage(
                guildId,
                serverId,
                Constants.COLOR_GREY,
                str,
                steamId,
            );

            if (instance.generalSettings.connectionNotify) {
                await rustplus.sendInGameMessage(str);
            }

            rustplus.log(client.intlGet(null, 'infoCap'), str);

            rustplus.updateConnections(steamId, str);
        }

        for (const steamId of newPlayers) {
            for (const player of teamInfo.members) {
                if (player.steamId.toString() === steamId) {
                    const str = client.intlGet(guildId, 'playerJoinedTheTeam', {
                        name: getPlayerName(instance.generalSettings.teammateNameType, player),
                    });

                    await DiscordMessages.sendActivityNotificationMessage(
                        guildId,
                        serverId,
                        Constants.COLOR_ACTIVE,
                        str,
                        steamId,
                    );

                    if (instance.generalSettings.connectionNotify) {
                        await rustplus.sendInGameMessage(str);
                    }

                    rustplus.log(client.intlGet(null, 'infoCap'), str);

                    rustplus.updateConnections(steamId, str);
                }
            }
        }

        for (const player of rustplus.team.players) {
            if (leftPlayers.includes(player.steamId)) continue;
            for (const playerUpdated of teamInfo.members) {
                if (player.steamId === playerUpdated.steamId.toString()) {
                    if (player.isGoneDead(playerUpdated)) {
                        const location = player.pos === null ? 'spawn' : player.pos.string;

                        const str = client.intlGet(guildId, 'playerJustDied', {
                            name: getPlayerName(instance.generalSettings.teammateNameType, player),
                            location: location,
                        });

                        await DiscordMessages.sendActivityNotificationMessage(
                            guildId,
                            serverId,
                            Constants.COLOR_INACTIVE,
                            str,
                            player.steamId,
                        );

                        if (instance.generalSettings.deathNotify) {
                            rustplus.sendInGameMessage(str);
                        }

                        rustplus.log(client.intlGet(null, 'infoCap'), str);

                        rustplus.updateDeaths(player.steamId, {
                            name: player.name,
                            location: player.pos,
                        });
                    }

                    if (player.isGoneAfk(playerUpdated)) {
                        if (instance.generalSettings.afkNotify) {
                            const str = client.intlGet(guildId, 'playerJustWentAfk', {
                                name: getPlayerName(instance.generalSettings.teammateNameType, player),
                            });

                            rustplus.sendInGameMessage(str);
                            rustplus.log(client.intlGet(null, 'infoCap'), str);
                        }
                    }

                    if (player.isAfk() && player.isMoved(playerUpdated)) {
                        if (instance.generalSettings.afkNotify) {
                            const afkTime = player.getAfkTime('dhs');
                            const str = client.intlGet(guildId, 'playerJustReturned', {
                                name: getPlayerName(instance.generalSettings.teammateNameType, player),
                                time: afkTime,
                            });
                            
                            rustplus.sendInGameMessage(str);
                            rustplus.log(client.intlGet(null, 'infoCap'), str);
                        }
                    }

                    if (player.isGoneOnline(playerUpdated)) {
                        const str = client.intlGet(guildId, 'playerJustConnected', {
                            name: getPlayerName(instance.generalSettings.teammateNameType, player),
                        });

                        await DiscordMessages.sendActivityNotificationMessage(
                            guildId,
                            serverId,
                            Constants.COLOR_ACTIVE,
                            str,
                            player.steamId,
                        );

                        if (instance.generalSettings.connectionNotify) {
                            await rustplus.sendInGameMessage(str);
                        }

                        rustplus.log(
                            client.intlGet(null, 'infoCap'),
                            client.intlGet(null, 'playerJustConnectedTo', {
                                name: player.name,
                                server: server.title,
                            }),
                        );

                        rustplus.updateConnections(player.steamId, str);
                    }

                    if (player.isGoneOffline(playerUpdated)) {
                        const str = client.intlGet(guildId, 'playerJustDisconnected', {
                            name: getPlayerName(instance.generalSettings.teammateNameType, player),
                        });

                        await DiscordMessages.sendActivityNotificationMessage(
                            guildId,
                            serverId,
                            Constants.COLOR_INACTIVE,
                            str,
                            player.steamId,
                        );

                        if (instance.generalSettings.connectionNotify) {
                            await rustplus.sendInGameMessage(str);
                        }

                        rustplus.log(
                            client.intlGet(null, 'infoCap'),
                            client.intlGet(null, 'playerJustDisconnectedFrom', {
                                name: player.name,
                                server: server.title,
                            }),
                        );

                        rustplus.updateConnections(player.steamId, str);
                    }

                    break;
                }
            }
        }
    },
};
