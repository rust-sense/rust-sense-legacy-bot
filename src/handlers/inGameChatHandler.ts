import type DiscordBot from '../structures/DiscordBot.js';
import * as Constants from '../util/constants.js';

export async function inGameChatHandler(rustplus: any, client: DiscordBot, message: string | string[] | null = null): Promise<void> {
    const guildId = rustplus.guildId;
    const generalSettings = rustplus.generalSettings;
    const commandDelayMs = parseInt(generalSettings.commandDelay) * 1000;
    const trademark = generalSettings.trademark;
    const trademarkString = trademark === 'NOT SHOWING' ? '' : `${trademark} | `;
    const messageMaxLength = Constants.MAX_LENGTH_TEAM_MESSAGE - trademarkString.length;

    if (message === null) {
        /* Timer callback: send the next queued message */
        if (rustplus.inGameChatQueue.length !== 0) {
            clearTimeout(rustplus.inGameChatTimeout);
            rustplus.inGameChatTimeout = null;

            const messageFromQueue = rustplus.inGameChatQueue[0];
            rustplus.inGameChatQueue = rustplus.inGameChatQueue.slice(1);

            rustplus.updateBotMessages(messageFromQueue);
            await rustplus.sendTeamMessageAsync(messageFromQueue);
            rustplus.log(client.intlGet(guildId, 'messageCap'), messageFromQueue);
        } else {
            clearTimeout(rustplus.inGameChatTimeout);
            rustplus.inGameChatTimeout = null;
        }
    } else {
        if (rustplus.team === null || rustplus.team.allOffline || generalSettings.muteInGameBotMessages) {
            return;
        }

        if (Array.isArray(message)) {
            for (const msg of message) {
                handleMessage(rustplus, msg, trademarkString, messageMaxLength);
            }
        } else {
            handleMessage(rustplus, message, trademarkString, messageMaxLength);
        }
    }

    /* Start timer if there are queued messages and no active timeout */
    if (rustplus.inGameChatQueue.length !== 0 && rustplus.inGameChatTimeout === null) {
        rustplus.inGameChatTimeout = setTimeout(inGameChatHandler, commandDelayMs, rustplus, client, null);
    }
}

function handleMessage(rustplus: any, message: string, trademarkString: string, maxLength: number): void {
    if (typeof message !== 'string') return;

    const chunks = message.match(new RegExp(`.{1,${maxLength}}(\\s|$)`, 'g'));
    if (!chunks) return;

    for (const chunk of chunks) {
        rustplus.inGameChatQueue.push(`${trademarkString}${chunk}`);
    }
}
