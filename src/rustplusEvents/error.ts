import * as DiscordMessages from '../discordTools/discordMessages.js';

export default {
    name: 'error',
    async execute(rustplus: any, client: any, err: any) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        rustplus.log(client.intlGet(null, 'errorCap'), err, 'error');

        switch (err.code) {
            case 'ETIMEDOUT':
                {
                    errorTimedOut(rustplus, client, err);
                }
                break;

            case 'ENOTFOUND':
                {
                    errorNotFound(rustplus, client, err);
                }
                break;

            case 'ECONNREFUSED':
                {
                    await errorConnRefused(rustplus, client, err);
                }
                break;

            default:
                {
                    errorOther(rustplus, client, err);
                }
                break;
        }
    },
};

function errorTimedOut(rustplus: any, client: any, err: any) {
    if (err.syscall === 'connect') {
        rustplus.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'couldNotConnectTo', {
                id: rustplus.serverId,
            }),
            'error',
        );
    }
}

function errorNotFound(rustplus: any, client: any, err: any) {
    if (err.syscall === 'getaddrinfo') {
        rustplus.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'couldNotConnectTo', {
                id: rustplus.serverId,
            }),
            'error',
        );
    }
}

async function errorConnRefused(rustplus: any, client: any, err: any) {
    rustplus.log(
        client.intlGet(null, 'errorCap'),
        client.intlGet(null, 'connectionRefusedTo', {
            id: rustplus.serverId,
        }),
        'error',
    );
}

function errorOther(rustplus: any, client: any, err: any) {
    if (err.toString() === 'Error: WebSocket was closed before the connection was established') {
        rustplus.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'websocketClosedBeforeConnection'),
            'error',
        );
    }
}