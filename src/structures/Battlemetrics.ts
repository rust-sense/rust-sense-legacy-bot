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
    private _serverEvaluation: Record<string, unknown> = {};

    constructor(id: string | null = null, name: string | null = null) {
        this._id = id;
        this._name = name;
    }

    get id(): string | null {
        return this._id;
    }
    set id(id: string | null) {
        this._id = id;
    }
    get name(): string | null {
        return this._name;
    }
    set name(name: string | null) {
        this._name = name;
    }
    get data(): BattlemetricsData | null {
        return this._data;
    }
    set data(data: BattlemetricsData | null) {
        this._data = data;
    }
    get ready(): boolean {
        return this._ready;
    }
    set ready(ready: boolean) {
        this._ready = ready;
    }
    get updatedAt(): Date | null {
        return this._updatedAt;
    }
    set updatedAt(updatedAt: Date | null) {
        this._updatedAt = updatedAt;
    }
    get lastUpdateSuccessful(): boolean | null {
        return this._lastUpdateSuccessful;
    }
    set lastUpdateSuccessful(lastUpdateSuccessful: boolean | null) {
        this._lastUpdateSuccessful = lastUpdateSuccessful;
    }
    get rustmapsAvailable(): boolean | null {
        return this._rustmapsAvailable;
    }
    set rustmapsAvailable(rustmapsAvailable: boolean | null) {
        this._rustmapsAvailable = rustmapsAvailable;
    }
    get streamerMode(): boolean {
        return this._streamerMode;
    }
    set streamerMode(streamerMode: boolean) {
        this._streamerMode = streamerMode;
    }
    get serverLog(): string[] {
        return this._serverLog;
    }
    get connectionLog(): string[] {
        return this._connectionLog;
    }
    get players(): Record<string, BattlemetricsPlayer> {
        return this._players;
    }
    get newPlayers(): string[] {
        return this._newPlayers;
    }
    get loginPlayers(): string[] {
        return this._loginPlayers;
    }
    get logoutPlayers(): string[] {
        return this._logoutPlayers;
    }
    get nameChangedPlayers(): Array<{ id: string; from: string; to: string }> {
        return this._nameChangedPlayers;
    }
    get onlinePlayers(): string[] {
        return this._onlinePlayers;
    }
    get offlinePlayers(): string[] {
        return this._offlinePlayers;
    }
    get serverEvaluation(): Record<string, unknown> {
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
        return Object.values(this.players).filter((player) => player.online);
    }

    getOfflinePlayers(): BattlemetricsPlayer[] {
        return Object.values(this.players).filter((player) => !player.online);
    }
}
