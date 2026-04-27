import { PlayerInfo, PlayerNameType } from '../types/Player.js';
import { getStreamerModeUsername } from './streamerModeUtils.js';

export function getPlayerName(playerNameType: PlayerNameType, playerInfo: PlayerInfo): string {
    switch (playerNameType) {
        case 'realName':
            return playerInfo.name;
        case 'streamerModeName':
            return getStreamerModeUsername(playerInfo.steamId);
        case 'combinedName':
            return `${playerInfo.name} (${getStreamerModeUsername(playerInfo.steamId)})`;
        default:
            throw new Error(`Unknown playerNameType: ${playerNameType}`);
    }
}
