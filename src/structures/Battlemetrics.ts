import Axios from 'axios';

import { client } from '../index.js';
import * as Utils from '../util/utils.js';
import getStaticFilesStorage from '../util/getStaticFilesStorage.js';

const randomUsernamesData = getStaticFilesStorage().getDatasetObject('RandomUsernames') as {
    RandomUsernames?: string[];
};
const randomUsernames = Array.isArray(randomUsernamesData.RandomUsernames) ? randomUsernamesData.RandomUsernames : [];

const SERVER_LOG_SIZE = 1000;
const CONNECTION_LOG_SIZE = 1000;
const PLAYER_CONNECTION_LOG_SIZE = 100;
const NAME_CHANGE_LOG_SIZE = 100;

interface BattlemetricsPlayer {
    id: string;
    name: string;
    online: boolean;
}

interface BattlemetricsData {
    data?: {
        attributes?: {
            name?: string;
            ip?: string;
            port?: number;
            players?: number;
            maxPlayers?: number;
            queue?: {
                size?: number;
            };
            details?: {
                rust_maps?: {
                    thumbnailUrl?: string;
                };
            };
        };
        relationships?: {
            player?: {
                data?: Array<{ id: string; attributes?: { name: string; online?: boolean } }>;
            };
        };
    };
}

export default class Battlemetrics {
    [key: string]: any;

    private _id: string | null;
    private _name: string | null;
    private _data: BattlemetricsData | null = null;
    private _ready = false;
    private _updatedAt: Date | null = null;
    private _lastUpdateSuccessful: boolean | null = null;
    private _rustmapsAvailable: boolean | null = null;
    private _streamerMode = true;
    private _serverLog: string[] = [];
    private _connectionLog: string[] = [];
    private _players: Record<string, BattlemetricsPlayer> = {};
    private _newPlayers: string[] = [];
    private _loginPlayers: string[] = [];
    private _logoutPlayers: string[] = [];
    private _nameChangedPlayers: Array<{ id: string; from: string; to: string }> = [];
    private _onlinePlayers: string[] = [];
    private _offlinePlayers: string[] = [];
    private _serverEvaluation: Record<string, any> = {};

    get serverEvaluation(): Record<string, any> {
        return this._serverEvaluation;
    }

    async update(): Promise<boolean> {
        if (!this.id) return false;

        try {
            const response = await Axios.get(`https://api.battlemetrics.com/servers/${this.id}`, {
                params: {
                    'include': 'player',
                },
            });

            this.data = response.data as BattlemetricsData;
            this.updatedAt = new Date();
            this.lastUpdateSuccessful = true;
            this.ready = true;

            return true;
        } catch (_e) {
            this.lastUpdateSuccessful = false;
            return false;
        }
    }

    getPlayer(id: string): BattlemetricsPlayer | undefined {
        return this.players[id];
    }

    getOnlinePlayers(): BattlemetricsPlayer[] {
        return (Object.values(this.players) as BattlemetricsPlayer[]).filter((player) => player.online);
    }

    getOfflinePlayers(): BattlemetricsPlayer[] {
        return (Object.values(this.players) as BattlemetricsPlayer[]).filter((player) => !player.online);
    }
}
