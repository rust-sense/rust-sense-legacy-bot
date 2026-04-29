import Colors from 'colors';
import path from 'path';
import Winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import config from '../config.js';

const consoleFormat = Winston.format.printf((info) => {
    const parts: string[] = [Colors.green(`[${info['timestamp']}]`)];
    if (info['guildId']) parts.push(Colors.yellow(`[${info['guildId']}]`));
    if (info['serverName']) parts.push(Colors.cyan(`[${info['serverName']}]`));
    parts.push(Colors.magenta(`${info['title']}:`));
    parts.push(String(info['text']));
    return parts.join(' ');
});

const fileFormat = Winston.format.printf((info) => String(info.message));

export default class Logger {
    private logger: Winston.Logger;
    private guildId: string | null = null;
    serverName: string | null = null;

    constructor(logBasename: string) {
        const transports: Winston.transport[] = [
            new Winston.transports.Console({
                stderrLevels: ['error', 'warn'],
                format: consoleFormat,
            }),
        ];

        if (config.general.logFileDir) {
            const ext = path.extname(logBasename);
            const stem = path.basename(logBasename, ext);
            transports.push(
                new DailyRotateFile({
                    dirname: config.general.logFileDir,
                    filename: `${stem}-%DATE%${ext}`,
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '10m',
                    maxFiles: '14d',
                    format: fileFormat,
                }),
            );
        }

        this.logger = Winston.createLogger({ transports });
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

        const fileParts = [time, this.guildId, this.serverName, `${title}: ${text}`].filter(Boolean);

        this.logger.log({
            level,
            message: fileParts.join(' | '),
            timestamp: time,
            title,
            text,
            guildId: this.guildId,
            serverName: this.serverName,
        });
    }

    setServerName(serverName: string | null): void {
        this.serverName = serverName;
    }
}
