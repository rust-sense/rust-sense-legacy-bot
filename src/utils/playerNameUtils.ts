import { PlayerInfo, PlayerNameType } from '../types/Player';
import { getStreamerModeUsername } from './streamerModeUtils';

export function getPlayerName(playerInfo: PlayerInfo, playerNameType: PlayerNameType): string {
    switch (playerNameType) {
        case 'realName':
            return playerInfo.name;
        case 'streamerModeName':
            return getStreamerModeUsername(playerInfo.steamId);
        case 'combined':
            return `${playerInfo.name} (${getStreamerModeUsername(playerInfo.steamId)})`;
    }
}
