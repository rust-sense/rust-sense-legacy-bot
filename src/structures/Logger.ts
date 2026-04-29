import path from 'path';

import Colors from 'colors';
import Winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import config from '../config.js';

export default class Logger {
    private logger: Winston.Logger;
    private type: string;
    private guildId: string | null = null;
    private serverName: string | null = null;

    constructor(logBasename: string, type: string) {
        const transports: Winston.transport[] = [];

        if (config.general.logFileDir) {
            // Strip extension so we can insert %DATE% before it: "discordBot.log" → "discordBot-%DATE%.log"
            const ext = path.extname(logBasename);
            const stem = path.basename(logBasename, ext);
            transports.push(
                new DailyRotateFile({
                    dirname: config.general.logFileDir,
                    filename: `${stem}-%DATE%${ext}`,
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '10m',
                    maxFiles: '14d',
                }),
            );
        }

        this.logger = Winston.createLogger({ transports });
        this.type = type;
    }

    setGuildId(guildId: string | null): void {
        this.guildId = guildId;
    }

    getTime(): string {
        const d = new Date();

        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const date = d.getDate() < 10 ? '0' + d.getDate() : d.getDate().toString();
        const hours = d.getHours() < 10 ? '0' + d.getHours() : d.getHours().toString();
        const minutes = d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes().toString();
        const seconds = d.getSeconds() < 10 ? '0' + d.getSeconds() : d.getSeconds().toString();

        return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
    }

    log(title: string, text: string, level: string): void {
        const time = this.getTime();

        const logText = `${title}: ${text}`;

        switch (this.type) {
            case 'default': {
                this.logger.log({
                    level: level,
                    message: `${time} | ${logText}`,
                });
                console.log(Colors.green(`[${time}]`), Colors.magenta(`${title}:`), text);
                break;
            }
            case 'guild': {
                this.logger.log({
                    level: level,
                    message: `${time} | ${this.guildId} | ${logText}`,
                });
                console.log(
                    Colors.green(`[${time}]`),
                    Colors.yellow(`[${this.guildId}]`),
                    Colors.magenta(`${title}:`),
                    text,
                );
                break;
            }
            case 'server': {
                this.logger.log({
                    level: level,
                    message: `${time} | ${this.guildId} | ${this.serverName} | ${logText}`,
                });
                console.log(
                    Colors.green(`[${time}]`),
                    Colors.yellow(`[${this.guildId}]`),
                    Colors.cyan(`[${this.serverName}]`),
                    Colors.magenta(`${title}:`),
                    text,
                );
                break;
            }
        }
    }

    setServerName(serverName: string | null): void {
        this.serverName = serverName;
    }
}
