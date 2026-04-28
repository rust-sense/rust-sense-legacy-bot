const RustPlusLib = require('@liamcottle/rustplus.js');

import { client } from '../index';
import rustplusLiteEvents from '../rustplusLiteEvents';

class RustPlusLite extends RustPlusLib {
    constructor(guildId, logger, rustplus, serverIp, appPort, steamId, playerToken) {
        super(serverIp, appPort, steamId, playerToken);

        this.serverId = `${this.server}-${this.port}`;
        this.guildId = guildId;
        this.logger = logger;
        this.rustplus = rustplus;

        this.isActive = true;
        this._reconnectAttempts = 0;

        this.loadRustPlusLiteEvents();
    }

    loadRustPlusLiteEvents() {
        for (const event of rustplusLiteEvents) {
            this.on(event.name, (...args) => event.execute(this, client, ...args));
        }
    }

    log(title, text, level = 'info') {
        this.logger.log(`${title} LITE`, text, level);
    }

    async getInfoAsync(timeout = 10000) {
        try {
            return await this.sendRequestAsync(
                {
                    getInfo: {},
                },
                timeout,
            ).catch((e) => {
                return e;
            });
        } catch (e) {
            return e;
        }
    }

    async promoteToLeaderAsync(steamId, timeout = 10000) {
        try {
            return await this.sendRequestAsync(
                {
                    promoteToLeader: {
                        steamId: steamId,
                    },
                },
                timeout,
            ).catch((e) => {
                return e;
            });
        } catch (e) {
            return e;
        }
    }

    isResponseValid(response) {
        if (response === undefined) {
            this.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'responseIsUndefined'), 'error');
            return false;
        }

        if (response.toString() === 'Error: Timeout reached while waiting for response') {
            this.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'responseTimeout'), 'error');
            return false;
        }

        if (Object.hasOwn(response, 'error')) {
            if (response.error === 'not_found') {
                return false;
            }

            this.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'responseContainError', {
                    error: JSON.stringify(response),
                }),
                'error',
            );
            return false;
        }

        if (Object.keys(response).length === 0) {
            this.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'responseIsEmpty'), 'error');
            return false;
        }

        return true;
    }
}

module.exports = RustPlusLite;
