import * as GameMap from '../domain/GameMap.js';
import * as Timer from '../domain/timer.js';

interface InfoData {
    name: string;
    headerImage: string;
    url: string;
    map: string;
    mapSize: number;
    wipeTime: number;
    players: number;
    maxPlayers: number;
    queuedPlayers: number;
    seed: number;
    salt: number;
}

export default class Info {
    private _name: string;
    private _headerImage: string;
    private _url: string;
    private _map: string;
    private _mapSize: number;
    private _wipeTime: number;
    private _players: number;
    private _maxPlayers: number;
    private _queuedPlayers: number;
    private _seed: number;
    private _salt: number;
    private _correctedMapSize: number;

    constructor(info: InfoData) {
        this._name = info.name;
        this._headerImage = info.headerImage;
        this._url = info.url;
        this._map = info.map;
        this._mapSize = info.mapSize;
        this._wipeTime = info.wipeTime;
        this._players = info.players;
        this._maxPlayers = info.maxPlayers;
        this._queuedPlayers = info.queuedPlayers;
        this._seed = info.seed;
        this._salt = info.salt;

        this._correctedMapSize = GameMap.getCorrectedMapSize(info.mapSize);
    }

    /* Getters and Setters */
    get name(): string {
        return this._name;
    }
    set name(name: string) {
        this._name = name;
    }
    get headerImage(): string {
        return this._headerImage;
    }
    set headerImage(headerImage: string) {
        this._headerImage = headerImage;
    }
    get url(): string {
        return this._url;
    }
    set url(url: string) {
        this._url = url;
    }
    get map(): string {
        return this._map;
    }
    set map(map: string) {
        this._map = map;
    }
    get mapSize(): number {
        return this._mapSize;
    }
    set mapSize(mapSize: number) {
        this._mapSize = mapSize;
    }
    get wipeTime(): number {
        return this._wipeTime;
    }
    set wipeTime(wipeTime: number) {
        this._wipeTime = wipeTime;
    }
    get players(): number {
        return this._players;
    }
    set players(players: number) {
        this._players = players;
    }
    get maxPlayers(): number {
        return this._maxPlayers;
    }
    set maxPlayers(maxPlayers: number) {
        this._maxPlayers = maxPlayers;
    }
    get queuedPlayers(): number {
        return this._queuedPlayers;
    }
    set queuedPlayers(queuedPlayers: number) {
        this._queuedPlayers = queuedPlayers;
    }
    get seed(): number {
        return this._seed;
    }
    set seed(seed: number) {
        this._seed = seed;
    }
    get salt(): number {
        return this._salt;
    }
    set salt(salt: number) {
        this._salt = salt;
    }
    get correctedMapSize(): number {
        return this._correctedMapSize;
    }
    set correctedMapSize(correctedMapSize: number) {
        this._correctedMapSize = correctedMapSize;
    }

    /* Change checkers */
    isNameChanged(info: InfoData): boolean {
        return this.name !== info.name;
    }

    isHeaderImageChanged(info: InfoData): boolean {
        return this.headerImage !== info.headerImage;
    }

    isUrlChanged(info: InfoData): boolean {
        return this.url !== info.url;
    }

    isMapChanged(info: InfoData): boolean {
        return this.map !== info.map;
    }

    isMapSizeChanged(info: InfoData): boolean {
        return this.mapSize !== info.mapSize;
    }

    isWipeTimeChanged(info: InfoData): boolean {
        return this.wipeTime !== info.wipeTime;
    }

    isPlayersChanged(info: InfoData): boolean {
        return this.players !== info.players;
    }

    isMaxPlayersChanged(info: InfoData): boolean {
        return this.maxPlayers !== info.maxPlayers;
    }

    isQueuedPlayersChanged(info: InfoData): boolean {
        return this.queuedPlayers !== info.queuedPlayers;
    }

    isSeedChanged(info: InfoData): boolean {
        return this.seed !== info.seed;
    }

    isSaltChanged(info: InfoData): boolean {
        return this.salt !== info.salt;
    }

    /* Other checkers */
    isMaxPlayersIncreased(info: InfoData): boolean {
        return this.maxPlayers < info.maxPlayers;
    }

    isMaxPlayersDecreased(info: InfoData): boolean {
        return this.maxPlayers > info.maxPlayers;
    }

    isQueue(): boolean {
        return this.queuedPlayers !== 0;
    }

    updateInfo(info: InfoData): void {
        this.name = info.name;
        this.headerImage = info.headerImage;
        this.url = info.url;
        this.map = info.map;
        this.mapSize = info.mapSize;
        this.wipeTime = info.wipeTime;
        this.players = info.players;
        this.maxPlayers = info.maxPlayers;
        this.queuedPlayers = info.queuedPlayers;
        this.seed = info.seed;
        this.salt = info.salt;

        this.correctedMapSize = GameMap.getCorrectedMapSize(info.mapSize);
    }

    getSecondsSinceWipe(): number {
        return (new Date().getTime() - new Date(this.wipeTime * 1000).getTime()) / 1000;
    }

    getTimeSinceWipe(ignore = ''): string {
        return Timer.secondsToFullScale(this.getSecondsSinceWipe(), ignore);
    }
}
