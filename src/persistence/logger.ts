import Logger from '../structures/Logger.js';

export interface PersistenceLogger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

class WinstonPersistenceLogger implements PersistenceLogger {
    private readonly logger = new Logger('persistence.log');

    info(message: string): void {
        this.logger.log('Persistence', message, 'info');
    }

    warn(message: string): void {
        this.logger.log('Persistence', message, 'warn');
    }

    error(message: string): void {
        this.logger.log('Persistence', message, 'error');
    }
}

export const persistenceLogger: PersistenceLogger = new WinstonPersistenceLogger();
