import * as Constants from '../util/constants.js';
import * as GameMap from '../util/GameMap.js';
import * as Time from '../util/timer.js';

interface PlayerData {
    steamId: string | number;
    name: string;
    x: number;
    y: number;
    isOnline: boolean;
    spawnTime: number;
    isAlive: boolean;
    deathTime: number;
}

interface RustplusLike {
    info: { mapSize: number };
    guildId: string;
    promoteToLeaderAsync: (steamId: string) => Promise<unknown>;
}

export default class Player {
    private _steamId: string;
    private _name: string;
    private _x: number;
    private _y: number;
    private _isOnline: boolean;
    private _spawnTime: number;
    private _isAlive: boolean;
    private _deathTime: number;
    private _rustplus: RustplusLike;
    private _pos: {
        location: string | null;
        monument: string | null;
        string: string | null;
        x: number;
        y: number;
    } | null = null;
    private _lastMovement = new Date();
    private _teamLeader = false;
    private _afkSeconds = 0;
    private _wentOfflineTime: Date | null = null;

    constructor(player: PlayerData, rustplus: RustplusLike) {
        this._steamId = player.steamId.toString();
        this._name = player.name;
        this._x = player.x;
        this._y = player.y;
        this._isOnline = player.isOnline;
        this._spawnTime = player.spawnTime;
        this._isAlive = player.isAlive;
        this._deathTime = player.deathTime;

        this._rustplus = rustplus;

        this.updatePos();
    }

    /* Getters and Setters */
    get steamId(): string {
        return this._steamId;
    }
    set steamId(steamId: string) {
        this._steamId = steamId;
    }
    get name(): string {
        return this._name;
    }
    set name(name: string) {
        this._name = name;
    }
    get x(): number {
        return this._x;
    }
    set x(x: number) {
        this._x = x;
    }
    get y(): number {
        return this._y;
    }
    set y(y: number) {
        this._y = y;
    }
    get isOnline(): boolean {
        return this._isOnline;
    }
    set isOnline(isOnline: boolean) {
        this._isOnline = isOnline;
    }
    get spawnTime(): number {
        return this._spawnTime;
    }
    set spawnTime(spawnTime: number) {
        this._spawnTime = spawnTime;
    }
    get isAlive(): boolean {
        return this._isAlive;
    }
    set isAlive(isAlive: boolean) {
        this._isAlive = isAlive;
    }
    get deathTime(): number {
        return this._deathTime;
    }
    set deathTime(deathTime: number) {
        this._deathTime = deathTime;
    }
    get rustplus(): RustplusLike {
        return this._rustplus;
    }
    set rustplus(rustplus: RustplusLike) {
        this._rustplus = rustplus;
    }
    get pos(): {
        location: string | null;
        monument: string | null;
        string: string | null;
        x: number;
        y: number;
    } | null {
        return this._pos;
    }
    set pos(pos: {
        location: string | null;
        monument: string | null;
        string: string | null;
        x: number;
        y: number;
    } | null) {
        this._pos = pos;
    }
    get lastMovement(): Date {
        return this._lastMovement;
    }
    set lastMovement(lastMovement: Date) {
        this._lastMovement = lastMovement;
    }
    get teamLeader(): boolean {
        return this._teamLeader;
    }
    set teamLeader(teamLeader: boolean) {
        this._teamLeader = teamLeader;
    }
    get afkSeconds(): number {
        return this._afkSeconds;
    }
    set afkSeconds(afkSeconds: number) {
        this._afkSeconds = afkSeconds;
    }
    get wentOfflineTime(): Date | null {
        return this._wentOfflineTime;
    }
    set wentOfflineTime(wentOfflineTime: Date | null) {
        this._wentOfflineTime = wentOfflineTime;
    }

    /* Change checkers */
    isSteamIdChanged(player: PlayerData): boolean {
        return this.steamId !== player.steamId.toString();
    }
    isNameChanged(player: PlayerData): boolean {
        return this.name !== player.name;
    }
    isXChanged(player: PlayerData): boolean {
        return this.x !== player.x;
    }
    isYChanged(player: PlayerData): boolean {
        return this.y !== player.y;
    }
    isOnlineChanged(player: PlayerData): boolean {
        return this.isOnline !== player.isOnline;
    }
    isSpawnTimeChanged(player: PlayerData): boolean {
        return this.spawnTime !== player.spawnTime;
    }
    isAliveChanged(player: PlayerData): boolean {
        return this.isAlive !== player.isAlive;
    }
    isDeathTimeChanged(player: PlayerData): boolean {
        return this.deathTime !== player.deathTime;
    }

    /* Other checkers */
    isGoneOnline(player: PlayerData): boolean {
        return this.isOnline === false && player.isOnline === true;
    }
    isGoneOffline(player: PlayerData): boolean {
        return this.isOnline === true && player.isOnline === false;
    }
    isGoneAlive(player: PlayerData): boolean {
        return this.isAlive === false && player.isAlive === true;
    }
    isGoneDead(player: PlayerData): boolean {
        return (this.isAlive === true && player.isAlive === false) || this.isDeathTimeChanged(player);
    }
    isMoved(player: PlayerData): boolean {
        return this.isXChanged(player) || this.isYChanged(player);
    }
    isAfk(): boolean {
        return this.afkSeconds >= Constants.AFK_TIME_SECONDS;
    }
    isGoneAfk(player: PlayerData): boolean {
        return (
            !this.isAfk() &&
            !this.isMoved(player) &&
            this.isOnline &&
            (new Date().getTime() - this.lastMovement.getTime()) / 1000 >= Constants.AFK_TIME_SECONDS
        );
    }

    updatePlayer(player: PlayerData): void {
        if (this.isGoneOffline(player)) {
            this.wentOfflineTime = new Date();
        }

        if (this.isGoneOnline(player)) {
            this.lastMovement = new Date();
            this.afkSeconds = 0;
        }

        if (this.isMoved(player)) {
            this.lastMovement = new Date();
            this.afkSeconds = 0;
        } else {
            if (!this.isOnline && !this.isGoneOnline(player)) {
                this.afkSeconds = 0;
            } else {
                this.afkSeconds = (new Date().getTime() - this.lastMovement.getTime()) / 1000;
            }
        }

        this.steamId = player.steamId.toString();
        this.name = player.name;
        this.x = player.x;
        this.y = player.y;
        this.isOnline = player.isOnline;
        this.spawnTime = player.spawnTime;
        this.isAlive = player.isAlive;
        this.deathTime = player.deathTime;

        this.updatePos();
    }

    updatePos(): void {
        if (this.isAlive || this.isOnline) {
            this.pos = GameMap.getPos(this.x, this.y, this.rustplus.info.mapSize, this.rustplus);
        } else {
            this.pos = null;
        }
    }

    getAfkSeconds(): number {
        return (new Date().getTime() - this.lastMovement.getTime()) / 1000;
    }
    getAfkTime(ignore = ''): string {
        return Time.secondsToFullScale(this.getAfkSeconds(), ignore);
    }

    getAliveSeconds(): number {
        if (this.spawnTime === 0) return 0;
        return (new Date().getTime() - new Date(this.spawnTime * 1000).getTime()) / 1000;
    }
    getAliveTime(ignore = ''): string {
        return Time.secondsToFullScale(this.getAliveSeconds(), ignore);
    }

    getDeathSeconds(): number {
        if (this.deathTime === 0) return 0;
        return (new Date().getTime() - new Date(this.deathTime * 1000).getTime()) / 1000;
    }
    getDeathTime(ignore = ''): string {
        return Time.secondsToFullScale(this.getDeathSeconds(), ignore);
    }
    getOfflineTime(ignore = ''): string | null {
        if (this.wentOfflineTime === null) return null;
        const seconds = (new Date().getTime() - this.wentOfflineTime.getTime()) / 1000;
        return Time.secondsToFullScale(seconds, ignore);
    }

    async assignLeader(): Promise<unknown> {
        return await this.rustplus.promoteToLeaderAsync(this.steamId);
    }
}
