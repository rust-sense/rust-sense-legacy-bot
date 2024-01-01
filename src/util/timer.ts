/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

export default {
    timer: function (callback, delay, ...args) {
        let id,
            started,
            remaining = delay,
            running = false;

        // @ts-expect-error TS(2339) FIXME: Property 'start' does not exist on type '{ timer: ... Remove this comment to see the full error message
        this.start = function () {
            started = new Date();
            if (remaining > 0) {
                id = setTimeout(callback, remaining, args);
                running = true;
                return true;
            } else {
                running = false;
                return false;
            }
        };

        // @ts-expect-error TS(2339) FIXME: Property 'stop' does not exist on type '{ timer: (... Remove this comment to see the full error message
        this.stop = function () {
            running = false;
            remaining = delay;
            clearTimeout(id);
        };

        // @ts-expect-error TS(2339) FIXME: Property 'pause' does not exist on type '{ timer: ... Remove this comment to see the full error message
        this.pause = function () {
            running = false;
            clearTimeout(id);
            // @ts-expect-error TS(2362) FIXME: The left-hand side of an arithmetic operation must... Remove this comment to see the full error message
            remaining -= new Date() - started;
        };

        // @ts-expect-error TS(2339) FIXME: Property 'restart' does not exist on type '{ timer... Remove this comment to see the full error message
        this.restart = function () {
            // @ts-expect-error TS(2339) FIXME: Property 'stop' does not exist on type '{ timer: (... Remove this comment to see the full error message
            this.stop();
            remaining = delay;
            // @ts-expect-error TS(2339) FIXME: Property 'start' does not exist on type '{ timer: ... Remove this comment to see the full error message
            this.start();
        };

        // @ts-expect-error TS(2339) FIXME: Property 'getTimeLeft' does not exist on type '{ t... Remove this comment to see the full error message
        this.getTimeLeft = function () {
            // @ts-expect-error TS(2339) FIXME: Property 'getStateRunning' does not exist on type ... Remove this comment to see the full error message
            if (this.getStateRunning()) {
                // @ts-expect-error TS(2339) FIXME: Property 'pause' does not exist on type '{ timer: ... Remove this comment to see the full error message
                this.pause();
                // @ts-expect-error TS(2339) FIXME: Property 'start' does not exist on type '{ timer: ... Remove this comment to see the full error message
                this.start();
            }

            if (remaining <= 0) return 0;
            return remaining;
        };

        // @ts-expect-error TS(2339) FIXME: Property 'isFinished' does not exist on type '{ ti... Remove this comment to see the full error message
        this.isFinished = function () {
            /* If exceeded initial delay value */
            // @ts-expect-error TS(2362) FIXME: The left-hand side of an arithmetic operation must... Remove this comment to see the full error message
            if (new Date() - started > delay) {
                running = false;
                return true;
            }
            return false;
        };

        // @ts-expect-error TS(2339) FIXME: Property 'getStateRunning' does not exist on type ... Remove this comment to see the full error message
        this.getStateRunning = function () {
            // @ts-expect-error TS(2339) FIXME: Property 'isFinished' does not exist on type '{ ti... Remove this comment to see the full error message
            this.isFinished();
            return running;
        };
    },

    getTimeLeftOfTimer: function (timer, ignore = '') {
        /* Returns the time left of a timer. If timer is not running, null will be returned. */
        if (timer.getStateRunning()) return this.secondsToFullScale(timer.getTimeLeft() / 1000, ignore);
        return null;
    },

    secondsToFullScale: function (totSeconds, ignore = '', longAbbr = false) {
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
    },

    convertDecimalToHoursMinutes: function (time) {
        let hours = Math.floor(time);
        let minutes = Math.floor((time - hours) * 60);

        // @ts-expect-error TS(2322) FIXME: Type 'string' is not assignable to type 'number'.
        hours = hours < 10 ? `0${hours}`.toString() : hours.toString();
        // @ts-expect-error TS(2322) FIXME: Type 'string' is not assignable to type 'number'.
        minutes = minutes < 10 ? `0${minutes}`.toString() : minutes.toString();

        return `${hours}:${minutes}`;
    },

    getSecondsFromStringTime: function (str) {
        const matches = str.match(/\d+[dhms]/g);
        let totSeconds = 0;

        if (matches === null) {
            return null;
        }

        for (const match of matches) {
            const value = parseInt(match.slice(0, -1));
            switch (match[match.length - 1]) {
                case 'd':
                    {
                        /* Days */
                        totSeconds += value * 24 * 60 * 60;
                    }
                    break;

                case 'h':
                    {
                        /* Hours */
                        totSeconds += value * 60 * 60;
                    }
                    break;

                case 'm':
                    {
                        /* Minutes */
                        totSeconds += value * 60;
                    }
                    break;

                case 's':
                    {
                        /* Seconds */
                        totSeconds += value;
                    }
                    break;
            }
        }

        return totSeconds;
    },

    sleep: function (ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    },

    getCurrentDateTime: function () {
        const newDate = new Date();

        const date = ('0' + newDate.getDate()).slice(-2);
        const month = ('0' + (newDate.getMonth() + 1)).slice(-2);
        const year = newDate.getFullYear();
        const hours = newDate.getHours();
        const minutes = newDate.getMinutes();
        const seconds = newDate.getSeconds();

        return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
    },
};
