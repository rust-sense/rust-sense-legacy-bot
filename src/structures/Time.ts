import * as TimeLib from '../util/timer.js';

interface TimeData {
    dayLengthMinutes: number;
    timeScale: number;
    sunrise: number;
    sunset: number;
    time: number;
}

interface ClientLike {
    getInstance: (guildId: string) => { serverList: Record<string, { timeTillDay: number | null; timeTillNight: number | null }> };
}

export default class Time {
    private _dayLengthMinutes: number;
    private _timeScale: number;
    private _sunrise: number;
    private _sunset: number;
    private _time: number;
    private _rustplus: unknown;
    private _client: ClientLike;
    private _startTime: number;
    private _timeTillDay: number | null = null;
    private _timeTillNight: number | null = null;
    private _timeTillActive = false;

    constructor(time: TimeData, rustplus: unknown, client: ClientLike) {
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

    /* Getters and Setters */
    get dayLengthMinutes(): number {
        return this._dayLengthMinutes;
    }
    set dayLengthMinutes(dayLengthMinutes: number) {
        this._dayLengthMinutes = dayLengthMinutes;
    }
    get timeScale(): number {
        return this._timeScale;
    }
    set timeScale(timeScale: number) {
        this._timeScale = timeScale;
    }
    get sunrise(): number {
        return this._sunrise;
    }
    set sunrise(sunrise: number) {
        this._sunrise = sunrise;
    }
    get sunset(): number {
        return this._sunset;
    }
    set sunset(sunset: number) {
        this._sunset = sunset;
    }
    get time(): number {
        return this._time;
    }
    set time(time: number) {
        this._time = time;
    }
    get rustplus(): unknown {
        return this._rustplus;
    }
    set rustplus(rustplus: unknown) {
        this._rustplus = rustplus;
    }
    get client(): ClientLike {
        return this._client;
    }
    set client(client: ClientLike) {
        this._client = client;
    }
    get startTime(): number {
        return this._startTime;
    }
    set startTime(startTime: number) {
        this._startTime = startTime;
    }
    get timeTillDay(): number | null {
        return this._timeTillDay;
    }
    set timeTillDay(timeTillDay: number | null) {
        this._timeTillDay = timeTillDay;
    }
    get timeTillNight(): number | null {
        return this._timeTillNight;
    }
    set timeTillNight(timeTillNight: number | null) {
        this._timeTillNight = timeTillNight;
    }
    get timeTillActive(): boolean {
        return this._timeTillActive;
    }
    set timeTillActive(timeTillActive: boolean) {
        this._timeTillActive = timeTillActive;
    }

    loadTimeTillConfig(): void {
        const instance = this.client.getInstance((this.rustplus as { guildId: string }).guildId);

        if (instance.serverList[(this.rustplus as { serverId: string }).serverId].timeTillDay !== null) {
            this.timeTillDay = instance.serverList[(this.rustplus as { serverId: string }).serverId].timeTillDay;
        }

        if (instance.serverList[(this.rustplus as { serverId: string }).serverId].timeTillNight !== null) {
            this.timeTillNight = instance.serverList[(this.rustplus as { serverId: string }).serverId].timeTillNight;
        }
    }

    isDay(): boolean {
        return this.time >= this.sunrise && this.time < this.sunset;
    }

    isNight(): boolean {
        return !this.isDay();
    }

    getTimeTillDayNight(): { day: number | null; night: number | null } {
        const dayLength = this.dayLengthMinutes * 60;
        const currentTime = this.time;
        const sunrise = this.sunrise;
        const sunset = this.sunset;

        let timeTillDay: number | null = null;
        let timeTillNight: number | null = null;

        if (currentTime < sunrise) {
            timeTillDay = ((sunrise - currentTime) / dayLength) * 24 * 60 * 60;
        } else if (currentTime >= sunrise && currentTime < sunset) {
            timeTillNight = ((sunset - currentTime) / dayLength) * 24 * 60 * 60;
        } else {
            timeTillDay = ((dayLength - currentTime + sunrise) / dayLength) * 24 * 60 * 60;
        }

        return { day: timeTillDay, night: timeTillNight };
    }

    updateTime(time: TimeData): void {
        this.dayLengthMinutes = time.dayLengthMinutes;
        this.timeScale = time.timeScale;
        this.sunrise = time.sunrise;
        this.sunset = time.sunset;
        this.time = time.time;

        if (!this.timeTillActive) {
            const timeTill = this.getTimeTillDayNight();
            this.timeTillDay = timeTill.day;
            this.timeTillNight = timeTill.night;
            this.timeTillActive = true;
        }
    }

    getTimeString(): string {
        return TimeLib.convertDecimalToHoursMinutes(this.time);
    }
}
