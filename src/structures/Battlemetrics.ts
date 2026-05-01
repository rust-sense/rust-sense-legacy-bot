import Axios from 'axios';

import { client } from '../index.js';
import getStaticFilesStorage from '../util/getStaticFilesStorage.js';
import * as Utils from '../util/utils.js';

const randomUsernamesData = getStaticFilesStorage().getDatasetObject('RandomUsernames') as {
    RandomUsernames?: string[];
};
const randomUsernames = Array.isArray(randomUsernamesData.RandomUsernames) ? randomUsernamesData.RandomUsernames : [];

const SERVER_LOG_SIZE = 1000;
const CONNECTION_LOG_SIZE = 1000;
const PLAYER_CONNECTION_LOG_SIZE = 100;
const NAME_CHANGE_LOG_SIZE = 100;

export default class Battlemetrics {
    [key: string]: any;

    private _id: string | null = null;
    private _name: string | null = null;
    private _data: Record<string, any> | null = null;
    private _ready = false;
    private _updatedAt: string | null = null;
    private _lastUpdateSuccessful: boolean | null = null;
    private _rustmapsAvailable: boolean | null = null;
    private _streamerMode = true;
    private _serverLog: any[] = [];
    private _connectionLog: any[] = [];
    private _players: Record<string, any> = {};
    private _newPlayers: string[] = [];
    private _loginPlayers: string[] = [];
    private _logoutPlayers: string[] = [];
    private _nameChangedPlayers: Array<{ id: string; from: string; to: string }> = [];
    private _onlinePlayers: string[] = [];
    private _offlinePlayers: string[] = [];
    private _serverEvaluation: Record<string, any> = {};

    constructor(id: string | null = null, name: string | null = null) {
        this._id = id;
        this._name = name;

        this.server_name = null;
        this.server_address = null;
        this.server_ip = null;
        this.server_port = null;
        this.server_players = null;
        this.server_maxPlayers = null;
        this.server_rank = null;
        this.server_location = null;
        this.server_status = null;
        this.server_private = null;
        this.server_createdAt = null;
        this.server_updatedAt = null;
        this.server_portQuery = null;
        this.server_country = null;
        this.server_queryStatus = null;
        this.server_official = null;
        this.server_rust_type = null;
        this.server_map = null;
        this.server_environment = null;
        this.server_rust_build = null;
        this.server_rust_ent_cnt_i = null;
        this.server_rust_fps = null;
        this.server_rust_fps_avg = null;
        this.server_rust_gc_cl = null;
        this.server_rust_gc_mb = null;
        this.server_rust_hash = null;
        this.server_rust_headerimage = null;
        this.server_rust_mem_pv = null;
        this.server_rust_mem_ws = null;
        this.server_pve = null;
        this.server_rust_uptime = null;
        this.server_rust_url = null;
        this.server_rust_world_seed = null;
        this.server_rust_world_size = null;
        this.server_rust_description = null;
        this.server_rust_modded = null;
        this.server_rust_queued_players = null;
        this.server_rust_gamemode = null;
        this.server_rust_born = null;
        this.server_rust_last_seed_change = null;
        this.server_rust_last_wipe = null;
        this.server_rust_last_wipe_ent = null;
        this.server_serverSteamId = null;
        this.map_url = null;
        this.map_thumbnailUrl = null;
        this.map_monuments = null;
        this.map_barren = null;
        this.map_updatedAt = null;
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
    get data(): Record<string, any> | null {
        return this._data;
    }
    set data(data: Record<string, any> | null) {
        this._data = data;
    }
    get ready(): boolean {
        return this._ready;
    }
    set ready(ready: boolean) {
        this._ready = ready;
    }
    get updatedAt(): string | null {
        return this._updatedAt;
    }
    set updatedAt(updatedAt: string | null) {
        this._updatedAt = updatedAt;
    }
    get lastUpdateSuccessful(): boolean | null {
        return this._lastUpdateSuccessful;
    }
    set lastUpdateSuccessful(v: boolean | null) {
        this._lastUpdateSuccessful = v;
    }
    get rustmapsAvailable(): boolean | null {
        return this._rustmapsAvailable;
    }
    set rustmapsAvailable(v: boolean | null) {
        this._rustmapsAvailable = v;
    }
    get streamerMode(): boolean {
        return this._streamerMode;
    }
    set streamerMode(v: boolean) {
        this._streamerMode = v;
    }
    get serverLog(): any[] {
        return this._serverLog;
    }
    set serverLog(v: any[]) {
        this._serverLog = v;
    }
    get connectionLog(): any[] {
        return this._connectionLog;
    }
    set connectionLog(v: any[]) {
        this._connectionLog = v;
    }
    get players(): Record<string, any> {
        return this._players;
    }
    set players(v: Record<string, any>) {
        this._players = v;
    }
    get newPlayers(): string[] {
        return this._newPlayers;
    }
    set newPlayers(v: string[]) {
        this._newPlayers = v;
    }
    get loginPlayers(): string[] {
        return this._loginPlayers;
    }
    set loginPlayers(v: string[]) {
        this._loginPlayers = v;
    }
    get logoutPlayers(): string[] {
        return this._logoutPlayers;
    }
    set logoutPlayers(v: string[]) {
        this._logoutPlayers = v;
    }
    get nameChangedPlayers(): Array<{ id: string; from: string; to: string }> {
        return this._nameChangedPlayers;
    }
    set nameChangedPlayers(v: Array<{ id: string; from: string; to: string }>) {
        this._nameChangedPlayers = v;
    }
    get onlinePlayers(): string[] {
        return this._onlinePlayers;
    }
    set onlinePlayers(v: string[]) {
        this._onlinePlayers = v;
    }
    get offlinePlayers(): string[] {
        return this._offlinePlayers;
    }
    set offlinePlayers(v: string[]) {
        this._offlinePlayers = v;
    }
    get serverEvaluation(): Record<string, any> {
        return this._serverEvaluation;
    }
    set serverEvaluation(v: Record<string, any>) {
        this._serverEvaluation = v;
    }

    SEARCH_SERVER_NAME_API_CALL(name: string): string {
        return `https://api.battlemetrics.com/servers?filter[search]=${name}&filter[game]=rust`;
    }

    GET_SERVER_DATA_API_CALL(id: string): string {
        return `https://api.battlemetrics.com/servers/${id}?include=player`;
    }

    GET_PROFILE_DATA_API_CALL(id: string): string {
        return `https://api.battlemetrics.com/players/${id}?include=identifier`;
    }

    GET_SERVER_MOST_TIME_PLAYED_API_CALL(id: string, days: number | null = null): string {
        let period = 'AT';
        if (days !== null) {
            const now = new Date().toISOString();
            const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
            period = `${daysAgo}:${now}`;
        }
        return `https://api.battlemetrics.com/servers/${id}/relationships/leaderboards/time?filter[period]=${period}`;
    }

    GET_BATTLEMETRICS_PLAYER_URL(id: string): string {
        return `https://www.battlemetrics.com/players/${id}`;
    }

    async #request(apiCall: string): Promise<any> {
        try {
            return await Axios.get(apiCall);
        } catch (_e) {
            return {};
        }
    }

    #parseMostTimePlayedApiResponse(data: any): any {
        const parsed: any = { players: [] };
        for (const entity of data.data) {
            if (entity.type !== 'leaderboardPlayer') continue;
            parsed.players.push({
                id: entity.id,
                name: Utils.removeInvisibleCharacters(entity.attributes.name),
                time: entity.attributes.value,
                rank: entity.attributes.rank,
                url: this.GET_BATTLEMETRICS_PLAYER_URL(entity.id),
            });
        }
        if (Object.hasOwn(data, 'links') && Object.hasOwn(data.links, 'next')) {
            parsed.next = data.links.next;
        }
        return parsed;
    }

    #parseProfileDataApiResponse(data: any): any[] {
        const parsed: any[] = [];
        for (const name of data.included) {
            if (name.type !== 'identifier') continue;
            if (!Object.hasOwn(name, 'attributes')) continue;
            if (!Object.hasOwn(name.attributes, 'type')) continue;
            if (name.attributes.type !== 'name') continue;
            if (!Object.hasOwn(name.attributes, 'identifier')) continue;
            if (!Object.hasOwn(name.attributes, 'lastSeen')) continue;
            parsed.push({ name: name.attributes.identifier, lastSeen: name.attributes.lastSeen });
        }
        return parsed;
    }

    #updateServerLog(data: any): void {
        if (this.serverLog.length === SERVER_LOG_SIZE) this.serverLog.pop();
        this.serverLog.unshift(data);
    }

    #updateConnectionLog(id: string, data: any): void {
        if (!Object.hasOwn(this.players, id)) return;
        if (this.players[id]['connectionLog'].length === PLAYER_CONNECTION_LOG_SIZE) {
            this.players[id]['connectionLog'].pop();
        }
        this.players[id]['connectionLog'].unshift(data);
        if (this.connectionLog.length === CONNECTION_LOG_SIZE) this.connectionLog.pop();
        this.connectionLog.unshift({ id, data });
    }

    #updateNameChangeHistory(id: string, data: any): void {
        if (!Object.hasOwn(this.players, id)) return;
        if (this.players[id]['nameChangeHistory'].length === NAME_CHANGE_LOG_SIZE) {
            this.players[id]['nameChangeHistory'].pop();
        }
        this.players[id]['nameChangeHistory'].unshift(data);
    }

    #evaluateServerParameter(key: string, value1: any, value2: any, firstTime: boolean): void {
        if (firstTime) return;
        let isDifferent = false;
        if (Array.isArray(value1) || Array.isArray(value2)) {
            if (value1.length !== value2.length || !value1.every((u: any, i: number) => u === value2[i])) {
                isDifferent = true;
            }
        } else if (value1 !== value2) {
            isDifferent = true;
        }
        if (isDifferent) {
            this.serverEvaluation[key] = { from: value1, to: value2 };
            this.#updateServerLog({ key, from: value1, to: value2, time: new Date().toISOString() });
        }
    }

    #formatTime(timestamp: string): [number, string] | null {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return null;
        const diffMs = Date.now() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);
        return [
            Math.floor(diffMs / 1000),
            `${diffHours.toString().padStart(2, '0')}:${diffMinutes.toString().padStart(2, '0')}`,
        ];
    }

    async request(apiCall: string): Promise<any> {
        if (this.id === null) return null;
        const response = await this.#request(apiCall);
        if (response.status !== 200) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'battlemetricsApiRequestFailed', { api_call: apiCall }),
                'error',
            );
            return null;
        }
        return response.data;
    }

    async setup(): Promise<void> {
        if (this.id === null && this.name === null) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'battlemetricsIdAndNameMissing'),
                'error',
            );
            return;
        }

        if (this.id === null && this.name !== null) {
            this.id = await this.getServerIdFromName(this.name);
            if (!this.id) return;
        }

        void this.updateStreamerMode();

        this.lastUpdateSuccessful = true;
        await this.evaluation(null, true);
    }

    async updateStreamerMode(): Promise<void> {
        const data = await this.request(this.GET_SERVER_MOST_TIME_PLAYED_API_CALL(this.id, 30));
        if (!data) return;
        const parsed = this.#parseMostTimePlayedApiResponse(data);
        for (const player of parsed.players) {
            if (!randomUsernames.includes(player.name)) this.streamerMode = false;
        }
    }

    async getServerIdFromName(name: string): Promise<string | null> {
        const originalName = name;
        name = encodeURI(name).replace('#', '*');
        const search = this.SEARCH_SERVER_NAME_API_CALL(name);
        const response = await this.#request(search);
        if (response.status !== 200) {
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'battlemetricsApiRequestFailed', { api_call: search }),
                'error',
            );
            return null;
        }
        for (const server of response.data.data) {
            if (server.attributes.name === originalName) return server.id;
        }
        return null;
    }

    async getProfileData(playerId: string): Promise<any[]> {
        const data = await this.request(this.GET_PROFILE_DATA_API_CALL(playerId));
        if (!data) return [];
        return this.#parseProfileDataApiResponse(data);
    }

    async evaluation(data: any = null, firstTime = false): Promise<boolean | null> {
        if (this.id === null) return null;

        if (data === null) {
            data = await this.request(this.GET_SERVER_DATA_API_CALL(this.id));
        }

        if (!data) {
            this.lastUpdateSuccessful = false;
            client.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'battlemetricsFailedToUpdate', { server: this.id }),
                'error',
            );
            return false;
        }

        this.data = data;
        const time = new Date().toISOString();
        this.updatedAt = time;

        const attributes = data.data.attributes;
        this.serverEvaluation = {};
        this.#evaluateServerParameter('server_name', this.server_name, attributes.name, firstTime);
        this.#evaluateServerParameter('server_address', this.server_address, attributes.address, firstTime);
        this.#evaluateServerParameter('server_ip', this.server_ip, attributes.ip, firstTime);
        this.#evaluateServerParameter('server_port', this.server_port, attributes.port, firstTime);
        this.#evaluateServerParameter('server_players', this.server_players, attributes.players, firstTime);
        this.#evaluateServerParameter('server_maxPlayers', this.server_maxPlayers, attributes.maxPlayers, firstTime);
        this.#evaluateServerParameter('server_rank', this.server_rank, attributes.rank, firstTime);
        this.#evaluateServerParameter('server_location', this.server_location, attributes.location, firstTime);
        this.#evaluateServerParameter('server_status', this.server_status, attributes.status, firstTime);
        this.#evaluateServerParameter('server_private', this.server_private, attributes.private, firstTime);
        this.#evaluateServerParameter('server_createdAt', this.server_createdAt, attributes.createdAt, firstTime);
        this.#evaluateServerParameter('server_updatedAt', this.server_updatedAt, attributes.updatedAt, firstTime);
        this.#evaluateServerParameter('server_portQuery', this.server_portQuery, attributes.portQuery, firstTime);
        this.#evaluateServerParameter('server_country', this.server_country, attributes.country, firstTime);
        this.#evaluateServerParameter('server_queryStatus', this.server_queryStatus, attributes.queryStatus, firstTime);

        const details = attributes.details;
        this.#evaluateServerParameter('server_official', this.server_official, details.official, firstTime);
        this.#evaluateServerParameter('server_rust_type', this.server_rust_type, details.rust_type, firstTime);
        this.#evaluateServerParameter('server_map', this.server_map, details.map, firstTime);
        this.#evaluateServerParameter('server_environment', this.server_environment, details.environment, firstTime);
        this.#evaluateServerParameter('server_rust_build', this.server_rust_build, details.rust_build, firstTime);
        this.#evaluateServerParameter(
            'server_rust_ent_cnt_i',
            this.server_rust_ent_cnt_i,
            details.rust_ent_cnt_i,
            firstTime,
        );
        this.#evaluateServerParameter('server_rust_fps', this.server_rust_fps, details.rust_fps, firstTime);
        this.#evaluateServerParameter('server_rust_fps_avg', this.server_rust_fps_avg, details.rust_fps_avg, firstTime);
        this.#evaluateServerParameter('server_rust_gc_cl', this.server_rust_gc_cl, details.rust_gc_cl, firstTime);
        this.#evaluateServerParameter('server_rust_gc_mb', this.server_rust_gc_mb, details.rust_gc_mb, firstTime);
        this.#evaluateServerParameter('server_rust_hash', this.server_rust_hash, details.rust_hash, firstTime);
        this.#evaluateServerParameter(
            'server_rust_headerimage',
            this.server_rust_headerimage,
            details.rust_headerimage,
            firstTime,
        );
        this.#evaluateServerParameter('server_rust_mem_pv', this.server_rust_mem_pv, details.rust_mem_pv, firstTime);
        this.#evaluateServerParameter('server_rust_mem_ws', this.server_rust_mem_ws, details.rust_mem_ws, firstTime);
        this.#evaluateServerParameter('server_pve', this.server_pve, details.pve, firstTime);
        this.#evaluateServerParameter('server_rust_uptime', this.server_rust_uptime, details.rust_uptime, firstTime);
        this.#evaluateServerParameter('server_rust_url', this.server_rust_url, details.rust_url, firstTime);
        this.#evaluateServerParameter(
            'server_rust_world_seed',
            this.server_rust_world_seed,
            details.rust_world_seed,
            firstTime,
        );
        this.#evaluateServerParameter(
            'server_rust_world_size',
            this.server_rust_world_size,
            details.rust_world_size,
            firstTime,
        );
        this.#evaluateServerParameter(
            'server_rust_description',
            this.server_rust_description,
            details.rust_description,
            firstTime,
        );
        this.#evaluateServerParameter('server_rust_modded', this.server_rust_modded, details.rust_modded, firstTime);
        this.#evaluateServerParameter(
            'server_rust_queued_players',
            this.server_rust_queued_players,
            details.rust_queued_players,
            firstTime,
        );
        this.#evaluateServerParameter(
            'server_rust_gamemode',
            this.server_rust_gamemode,
            details.rust_gamemode,
            firstTime,
        );
        this.#evaluateServerParameter('server_rust_born', this.server_rust_born, details.rust_born, firstTime);
        this.#evaluateServerParameter(
            'server_rust_last_seed_change',
            this.server_rust_last_seed_change,
            details.rust_last_seed_change,
            firstTime,
        );
        this.#evaluateServerParameter(
            'server_rust_last_wipe',
            this.server_rust_last_wipe,
            details.rust_last_wipe,
            firstTime,
        );
        this.#evaluateServerParameter(
            'server_rust_last_wipe_ent',
            this.server_rust_last_wipe_ent,
            details.rust_last_wipe_ent,
            firstTime,
        );
        this.#evaluateServerParameter(
            'server_serverSteamId',
            this.server_serverSteamId,
            details.serverSteamId,
            firstTime,
        );

        const rustMaps = details.rust_maps;
        if (rustMaps) {
            this.#evaluateServerParameter('map_url', this.map_url, rustMaps.url, firstTime);
            this.#evaluateServerParameter('map_thumbnailUrl', this.map_thumbnailUrl, rustMaps.thumbnailUrl, firstTime);
            this.#evaluateServerParameter('map_monuments', this.map_monuments, rustMaps.monuments, firstTime);
            this.#evaluateServerParameter('map_barren', this.map_barren, rustMaps.barren, firstTime);
            this.#evaluateServerParameter('map_updatedAt', this.map_updatedAt, rustMaps.updatedAt, firstTime);
        }

        this.newPlayers = [];
        this.loginPlayers = [];
        this.logoutPlayers = [];
        this.nameChangedPlayers = [];
        const prevOnlinePlayers = this.onlinePlayers;
        this.onlinePlayers = [];
        this.offlinePlayers = [];

        const included = data.included;
        for (const entity of included) {
            if (entity.type !== 'player') continue;

            const name = Utils.removeInvisibleCharacters(entity.attributes.name);
            if (!randomUsernames.includes(name)) this.streamerMode = false;

            if (!Object.hasOwn(this.players, entity.id)) {
                this.players[entity.id] = {};
                this.players[entity.id]['id'] = entity.id;
                this.players[entity.id]['name'] = name;
                this.players[entity.id]['private'] = entity.attributes.private;
                this.players[entity.id]['positiveMatch'] = entity.attributes.positiveMatch;
                this.players[entity.id]['createdAt'] = entity.attributes.createdAt;
                this.players[entity.id]['updatedAt'] = entity.attributes.updatedAt;
                const firstTimeEntry = entity.meta.metadata.find((e: any) => e.key === 'firstTime');
                if (firstTimeEntry) this.players[entity.id]['firstTime'] = firstTimeEntry.value;
                this.players[entity.id]['url'] = this.GET_BATTLEMETRICS_PLAYER_URL(entity.id);
                this.players[entity.id]['status'] = true;
                this.players[entity.id]['nameChangeHistory'] = [];
                this.players[entity.id]['connectionLog'] = [];
                this.players[entity.id]['logoutDate'] = null;
                if (!firstTime) this.#updateConnectionLog(entity.id, { type: 0, time });
                this.newPlayers.push(entity.id);
            } else {
                this.players[entity.id]['id'] = entity.id;
                if (this.players[entity.id]['name'] !== name) {
                    this.nameChangedPlayers.push({ id: entity.id, from: this.players[entity.id]['name'], to: name });
                    this.#updateNameChangeHistory(entity.id, {
                        from: this.players[entity.id]['name'],
                        to: name,
                        time,
                    });
                    this.players[entity.id]['name'] = name;
                }
                this.players[entity.id]['private'] = entity.attributes.private;
                this.players[entity.id]['positiveMatch'] = entity.attributes.positiveMatch;
                this.players[entity.id]['createdAt'] = entity.attributes.createdAt;
                this.players[entity.id]['updatedAt'] = entity.attributes.updatedAt;
                const firstTimeEntry = entity.meta.metadata.find((e: any) => e.key === 'firstTime');
                if (firstTimeEntry) this.players[entity.id]['firstTime'] = firstTimeEntry.value;
                this.players[entity.id]['url'] = this.GET_BATTLEMETRICS_PLAYER_URL(entity.id);
                if (this.players[entity.id]['status'] === false) {
                    this.players[entity.id]['status'] = true;
                    this.#updateConnectionLog(entity.id, { type: 0, time });
                    this.loginPlayers.push(entity.id);
                }
            }
            this.onlinePlayers.push(entity.id);
        }

        const offlinePlayerIds = prevOnlinePlayers.filter((e) => !this.onlinePlayers.includes(e));
        for (const id of offlinePlayerIds) {
            this.players[id]['status'] = false;
            this.players[id]['logoutDate'] = time;
            this.#updateConnectionLog(id, { type: 1, time });
            this.logoutPlayers.push(id);
        }

        for (const [playerId, content] of Object.entries(this.players)) {
            if ((content as any)['status'] === false) this.offlinePlayers.push(playerId);
        }

        this.updateFromData(data);
        return true;
    }

    updateFromData(data: any): void {
        this.ready = true;
        this.id = data.data.id;

        const attributes = data.data.attributes;
        this.server_name = attributes.name;
        this.server_address = attributes.address;
        this.server_ip = attributes.ip;
        this.server_port = attributes.port;
        this.server_players = attributes.players;
        this.server_maxPlayers = attributes.maxPlayers;
        this.server_rank = attributes.rank;
        this.server_location = attributes.location;
        this.server_status = attributes.status;
        this.server_private = attributes.private;
        this.server_createdAt = attributes.createdAt;
        this.server_updatedAt = attributes.updatedAt;
        this.server_portQuery = attributes.portQuery;
        this.server_country = attributes.country;
        this.server_queryStatus = attributes.queryStatus;

        const details = attributes.details;
        this.server_official = details.official;
        this.server_rust_type = details.rust_type;
        this.server_map = details.map;
        this.server_environment = details.environment;
        this.server_rust_build = details.rust_build;
        this.server_rust_ent_cnt_i = details.rust_ent_cnt_i;
        this.server_rust_fps = details.rust_fps;
        this.server_rust_fps_avg = details.rust_fps_avg;
        this.server_rust_gc_cl = details.rust_gc_cl;
        this.server_rust_gc_mb = details.rust_gc_mb;
        this.server_rust_hash = details.rust_hash;
        this.server_rust_headerimage = details.rust_headerimage;
        this.server_rust_mem_pv = details.rust_mem_pv;
        this.server_rust_mem_ws = details.rust_mem_ws;
        this.server_pve = details.pve;
        this.server_rust_uptime = details.rust_uptime;
        this.server_rust_url = details.rust_url;
        this.server_rust_world_seed = details.rust_world_seed;
        this.server_rust_world_size = details.rust_world_size;
        this.server_rust_description = details.rust_description;
        this.server_rust_modded = details.rust_modded;
        this.server_rust_queued_players = details.rust_queued_players;
        this.server_rust_gamemode = details.rust_gamemode;
        this.server_rust_born = details.rust_born;
        this.server_rust_last_seed_change = details.rust_last_seed_change;
        this.server_rust_last_wipe = details.rust_last_wipe;
        this.server_rust_last_wipe_ent = details.rust_last_wipe_ent;
        this.server_serverSteamId = details.serverSteamId;

        const rustMaps = details.rust_maps;
        if (rustMaps) {
            this.rustmapsAvailable = true;
            this.map_url = rustMaps.url;
            this.map_thumbnailUrl = rustMaps.thumbnailUrl;
            this.map_monuments = rustMaps.monuments;
            this.map_barren = rustMaps.barren;
            this.map_updatedAt = rustMaps.updatedAt;
        } else {
            this.rustmapsAvailable = false;
            this.map_url = null;
            this.map_thumbnailUrl = null;
            this.map_monuments = null;
            this.map_barren = null;
            this.map_updatedAt = null;
        }
    }

    getPlayer(id: string): any {
        return this.players[id];
    }

    getOnlinePlayers(): any[] {
        return Object.values(this.players).filter((p) => p.status === true);
    }

    getOfflinePlayers(): any[] {
        return Object.values(this.players).filter((p) => p.status === false);
    }

    getOnlineTime(playerId: string): [number, string] | null {
        if (
            !this.lastUpdateSuccessful ||
            !Object.hasOwn(this.players, playerId) ||
            !this.players[playerId]['updatedAt']
        ) {
            return null;
        }
        return this.#formatTime(this.players[playerId]['updatedAt']);
    }

    getOfflineTime(playerId: string): [number, string] | null {
        if (
            !this.lastUpdateSuccessful ||
            !Object.hasOwn(this.players, playerId) ||
            !this.players[playerId]['logoutDate']
        ) {
            return null;
        }
        return this.#formatTime(this.players[playerId]['logoutDate']);
    }

    getOnlinePlayerIdsOrderedByTime(): string[] {
        const unordered: [number, string][] = [];
        for (const playerId of this.onlinePlayers) {
            const seconds = this.#formatTime(this.players[playerId]['updatedAt']);
            unordered.push([seconds !== null ? seconds[0] : 0, playerId]);
        }
        return unordered.sort((a, b) => b[0] - a[0]).map((e) => e[1]);
    }

    getOfflinePlayerIdsOrderedByLeastTimeSinceOnline(): string[] {
        const unordered: [number, string][] = [];
        for (const playerId of this.offlinePlayers) {
            const seconds = this.#formatTime(this.players[playerId]['logoutDate']);
            unordered.push([seconds !== null ? seconds[0] : 0, playerId]);
        }
        return unordered.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    }
}
