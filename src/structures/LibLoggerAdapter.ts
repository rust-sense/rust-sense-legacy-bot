import type { ILogger } from '../lib/ILogger.js';

interface AppLogger {
    log(title: string, text: string, level: string): void;
}

export default class LibLoggerAdapter implements ILogger {
    constructor(
        private readonly logger: AppLogger,
        private readonly title: string,
    ) {}

    debug(message: string): void {
        this.logger.log(this.title, message, 'debug');
    }

    info(message: string): void {
        this.logger.log(this.title, message, 'info');
    }

    warn(message: string): void {
        this.logger.log(this.title, message, 'warn');
    }

    error(message: string): void {
        this.logger.log(this.title, message, 'error');
    }
}
