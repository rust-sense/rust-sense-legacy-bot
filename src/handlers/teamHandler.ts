import type DiscordBot from '../structures/DiscordBot.js';
import * as Constants from '../util/constants.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';

import { getPlayerName } from '../utils/playerNameUtils.js';

export async function handler(rustplus: any, client: DiscordBot, teamInfo: any): Promise<void> {
    /* Handle team changes */
    await checkChanges(rustplus, client, teamInfo);
}

export async function checkChanges(rustplus: any, client: DiscordBot, teamInfo: any): Promise<void> {
    const instance = client.getInstance(rustplus.guildId);
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
                    name: getPlayerName(instance.generalSettings.teammateNameType, {
                        name: player.name,
                        steamId: player.steamId.toString(),
                    }),
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
        }
    }

    rustplus.team.updateTeam(teamInfo);
}
