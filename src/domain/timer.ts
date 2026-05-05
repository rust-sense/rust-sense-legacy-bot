export class Timer {
    private id: ReturnType<typeof setTimeout> | undefined;
    private started: Date | undefined;
    private remaining: number;
    private running = false;

    constructor(
        private callback: (...args: unknown[]) => void,
        private delay: number,
        private args: unknown[] = [],
    ) {
        this.remaining = delay;
    }

    start(): boolean {
        this.started = new Date();
        if (this.remaining > 0) {
            this.id = setTimeout(this.callback, this.remaining, this.args);
            this.running = true;
            return true;
        }
        this.running = false;
        return false;
    }

    stop(): void {
        this.running = false;
        this.remaining = this.delay;
        clearTimeout(this.id);
    }

    pause(): void {
        this.running = false;
        clearTimeout(this.id);
        this.remaining -= new Date().getTime() - (this.started?.getTime() ?? 0);
    }

    restart(): void {
        this.stop();
        this.remaining = this.delay;
        this.start();
    }

    getTimeLeft(): number {
        if (this.getStateRunning()) {
            this.pause();
            this.start();
        }
        return this.remaining <= 0 ? 0 : this.remaining;
    }

    isFinished(): boolean {
        if (this.started && new Date().getTime() - this.started.getTime() > this.delay) {
            this.running = false;
            return true;
        }
        return false;
    }

    getStateRunning(): boolean {
        this.isFinished();
        return this.running;
    }
}

export function getTimeLeftOfTimer(timer: Timer, ignore = ''): string | null {
    if (timer.getStateRunning()) return secondsToFullScale(timer.getTimeLeft() / 1000, ignore);
    return null;
}

export function secondsToFullScale(totSeconds: number, ignore = '', longAbbr = false): string {
    totSeconds = Math.floor(totSeconds);

    const day = 86400;
    const hour = 3600;
    const minute = 60;
    const second = 1;

    const originalDays = Math.floor(totSeconds / day);
    const originalHours = Math.floor((totSeconds - originalDays * day) / hour);
    const originalMinutes = Math.floor((totSeconds - originalDays * day - originalHours * hour) / minute);
    const originalSeconds = totSeconds - originalDays * day - originalHours * hour - originalMinutes * minute;

    let days = 0;
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    let time = '';

    days += originalDays;
    if (days > 0 && !ignore.includes('d')) {
        time += longAbbr ? `${days} days ` : `${days}d `;
    } else if (days > 0 && ignore.includes('d')) {
        hours += (day / hour) * days;
    }

    hours += originalHours;
    if (hours > 0 && !ignore.includes('h')) {
        time += longAbbr ? `${hours} hours ` : `${hours}h `;
    } else if (hours > 0 && ignore.includes('h')) {
        minutes += (hour / minute) * hours;
    }

    minutes += originalMinutes;
    if (minutes > 0 && !ignore.includes('m')) {
        time += longAbbr ? `${minutes} min ` : `${minutes}m `;
    } else if (minutes > 0 && ignore.includes('m')) {
        seconds += (minute / second) * minutes;
    }

    seconds += originalSeconds;
    if (seconds > 0 && !ignore.includes('s')) {
        time += longAbbr ? `${seconds} sec ` : `${seconds}s`;
    }

    time = time.trim();

    if (time === '') {
        if (!ignore.includes('s')) {
            time = longAbbr ? '0 sec' : '0s';
        } else if (!ignore.includes('m')) {
            time = longAbbr ? '0 min' : '0m';
        } else if (!ignore.includes('h')) {
            time = longAbbr ? '0 hours' : '0h';
        } else if (!ignore.includes('d')) {
            time = longAbbr ? '0 days' : '0d';
        } else {
            time = longAbbr ? '0 sec' : '0s';
        }
    }
    return time;
}

export function convertDecimalToHoursMinutes(time: number): string {
    let hours = Math.floor(time);
    let minutes = Math.floor((time - hours) * 60);

    const hoursStr = hours < 10 ? `0${hours}` : hours.toString();
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();

    return `${hoursStr}:${minutesStr}`;
}

export function getSecondsFromStringTime(str: string): number | null {
    const matches = str.match(/\d+[dhms]/g);
    let totSeconds = 0;

    if (matches === null) {
        return null;
    }

    for (const match of matches) {
        const value = parseInt(match.slice(0, -1));
        switch (match[match.length - 1]) {
            case 'd':
                totSeconds += value * 24 * 60 * 60;
                break;
            case 'h':
                totSeconds += value * 60 * 60;
                break;
            case 'm':
                totSeconds += value * 60;
                break;
            case 's':
                totSeconds += value;
                break;
        }
    }

    return totSeconds;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function getCurrentDateTime(): string {
    const newDate = new Date();

    const date = ('0' + newDate.getDate()).slice(-2);
    const month = ('0' + (newDate.getMonth() + 1)).slice(-2);
    const year = newDate.getFullYear();
    const hours = newDate.getHours();
    const minutes = newDate.getMinutes();
    const seconds = newDate.getSeconds();

    return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}
