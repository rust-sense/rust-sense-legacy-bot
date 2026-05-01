import Colors from 'colors';
import Winston from 'winston';
import config from '../config.js';

function makeFormat(prefix: string) {
    return Winston.format.printf(({ message }) => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const ts = `${d.getFullYear()}-${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        return `${Colors.green(`[${ts}]`)} ${Colors.magenta(`${prefix}:`)} ${message}`;
    });
}

function createLibLogger(prefix: string): Winston.Logger {
    return Winston.createLogger({
        level: config.general.logLevel,
        transports: [
            new Winston.transports.Console({
                stderrLevels: ['error', 'warn'],
                format: makeFormat(prefix),
            }),
        ],
    });
}

export const fcmLogger = createLibLogger('FCM');
export const rustPlusLogger = createLibLogger('RustPlus');
