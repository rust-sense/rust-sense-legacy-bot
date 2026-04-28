// @ts-nocheck
import RustPlusLib from '@liamcottle/rustplus.js';

import { resolve } from '../container.js';
import rustplusLiteEvents from '../rustplusLiteEvents/index.js';

function getClient() {
    return resolve<{
        intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string;
    }>('discordBot');
}

interface LoggerLike {
    log: (title: string, text: string, level: string) => void;
}

interface RustplusLike {
    serverId: string;
}

export default class RustPlusLite extends RustPlusLib {
    serverId: string;
    guildId: string;
    logger: LoggerLike;
    rustplus: RustplusLike;
    isActive = true;
    _reconnectAttempts = 0;

    constructor(
        guildId: string,
        logger: LoggerLike,
        rustplus: RustplusLike,
        serverIp: string,
        appPort: number,
        steamId: string,
        playerToken: string,
    ) {
        super(serverIp, appPort, steamId, playerToken);

        this.serverId = `${this.server}-${this.port}`;
        this.guildId = guildId;
        this.logger = logger;
        this.rustplus = rustplus;

        this.loadRustPlusLiteEvents();
    }

    loadRustPlusLiteEvents(): void {
        for (const event of rustplusLiteEvents) {
            this.on(event.name, (...args: unknown[]) => event.execute(this, getClient(), ...args));
        }
    }

    log(title: string, text: string, level = 'info'): void {
        this.logger.log(`${title} LITE`, text, level);
    }

    async getInfoAsync(timeout = 10000): Promise<unknown> {
        try {
            return await this.sendRequestAsync(
                {
                    getInfo: {},
                },
                timeout,
            ).catch((e: unknown) => {
                return e;
            });
        } catch (e) {
            return e;
        }
    }

    async promoteToLeaderAsync(steamId: string, timeout = 10000): Promise<unknown> {
        try {
            return await this.sendRequestAsync(
                {
                    promoteToLeader: {
                        steamId,
                    },
                },
                timeout,
            ).catch((e: unknown) => {
                return e;
            });
        } catch (e) {
            return e;
        }
    }

    isResponseValid(response: unknown): boolean {
        const client = getClient();
        if (response === undefined) {
            this.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'responseIsUndefined'), 'error');
            return false;
        }

        if (response?.toString() === 'Error: Timeout reached while waiting for response') {
            this.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'responseTimeout'), 'error');
            return false;
        }

        if (Object.hasOwn(response as object, 'error')) {
            const errorResponse = response as { error: string };
            if (errorResponse.error === 'not_found') {
                return false;
            }

            this.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'responseContainError', {
                    error: errorResponse.error,
                }),
                'error',
            );
            return false;
        }

        return true;
    }
}
