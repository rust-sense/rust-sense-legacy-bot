import { getPersistenceCache } from '../persistence/index.js';
import * as TimeLib from '../util/timer.js';

interface TimeData {
    dayLengthMinutes: number;
    timeScale: number;
    sunrise: number;
    sunset: number;
    time: number;
}

interface RustplusLike {
    guildId: string;
    serverId: string;
}

type ClientLike = object;

export default class Time {
    private _dayLengthMinutes: number;
    private _timeScale: number;
    private _sunrise: number;
    private _sunset: number;
    private _time: number;
    private _rustplus: RustplusLike;
    private _client: ClientLike;
    private _startTime: number;
    private _timeTillDay: Record<string, number> = {};
    private _timeTillNight: Record<string, number> = {};
    private _timeTillActive = false;

    constructor(time: TimeData, rustplus: RustplusLike, client: ClientLike) {
        this._dayLengthMinutes = time.dayLengthMinutes;
        this._timeScale = time.timeScale;
        this._sunrise = time.sunrise;
        this._sunset = time.sunset;
        this._time = time.time;
        this._rustplus = rustplus;
        this._client = client;
        this._startTime = time.time;
        this.loadTimeTillConfig();
    }

    get dayLengthMinutes(): number {
        return this._dayLengthMinutes;
    }
    set dayLengthMinutes(v: number) {
        this._dayLengthMinutes = v;
    }
    get timeScale(): number {
        return this._timeScale;
    }
    set timeScale(v: number) {
        this._timeScale = v;
    }
    get sunrise(): number {
        return this._sunrise;
    }
    set sunrise(v: number) {
        this._sunrise = v;
    }
    get sunset(): number {
        return this._sunset;
    }
    set sunset(v: number) {
        this._sunset = v;
    }
    get time(): number {
        return this._time;
    }
    set time(v: number) {
        this._time = v;
    }
    get rustplus(): RustplusLike {
        return this._rustplus;
    }
    set rustplus(v: RustplusLike) {
        this._rustplus = v;
    }
    get client(): ClientLike {
        return this._client;
    }
    set client(v: ClientLike) {
        this._client = v;
    }
    get startTime(): number {
        return this._startTime;
    }
    set startTime(v: number) {
        this._startTime = v;
    }
    get timeTillDay(): Record<string, number> {
        return this._timeTillDay;
    }
    set timeTillDay(v: Record<string, number>) {
        this._timeTillDay = v;
    }
    get timeTillNight(): Record<string, number> {
        return this._timeTillNight;
    }
    set timeTillNight(v: Record<string, number>) {
        this._timeTillNight = v;
    }
    get timeTillActive(): boolean {
        return this._timeTillActive;
    }
    set timeTillActive(v: boolean) {
        this._timeTillActive = v;
    }

    isDayLengthMinutesChanged(time: TimeData): boolean {
        return this.dayLengthMinutes !== time.dayLengthMinutes;
    }

    isTimeScaleChanged(time: TimeData): boolean {
        return this.timeScale !== time.timeScale;
    }

    isSunriseChanged(time: TimeData): boolean {
        return this.sunrise !== time.sunrise;
    }

    isSunsetChanged(time: TimeData): boolean {
        return this.sunset !== time.sunset;
    }

    isTimeChanged(time: TimeData): boolean {
        return this.time !== time.time;
    }

    isDay(): boolean {
        return this.time >= this.sunrise && this.time < this.sunset;
    }

    isNight(): boolean {
        return !this.isDay();
    }

    isTurnedDay(time: TimeData): boolean {
        return this.isNight() && time.time >= time.sunrise && time.time < time.sunset;
    }

    isTurnedNight(time: TimeData): boolean {
        return this.isDay() && !(time.time >= time.sunrise && time.time < time.sunset);
    }

    async loadTimeTillConfig(): Promise<void> {
        const instance = await getPersistenceCache().readGuildState(this.rustplus.guildId);
        const server = instance.serverList[this.rustplus.serverId];

        if (server.timeTillDay !== null) this.timeTillDay = server.timeTillDay;
        if (server.timeTillNight !== null) this.timeTillNight = server.timeTillNight;

        this.timeTillActive =
            Object.keys(this.timeTillDay).length !== 0 && Object.keys(this.timeTillNight).length !== 0;
    }

    updateTime(time: TimeData): void {
        this.dayLengthMinutes = time.dayLengthMinutes;
        this.timeScale = time.timeScale;
        this.sunrise = time.sunrise;
        this.sunset = time.sunset;
        this.time = time.time;
    }

    getTimeTillDayOrNight(ignore = ''): string | null {
        if (!this.timeTillActive) return null;

        const object = this.isDay() ? this.timeTillNight : this.timeTillDay;
        const time = this.time;

        const closest = Object.keys(object)
            .map(Number)
            .reduce((a, b) => (Math.abs(b - time) < Math.abs(a - time) ? b : a));

        return TimeLib.secondsToFullScale(object[closest], ignore);
    }

    getTimeString(): string {
        return TimeLib.convertDecimalToHoursMinutes(this.time);
    }
}
