import type DiscordBot from '../structures/DiscordBot.js';
import * as Constants from '../util/constants.js';

export async function inGameChatHandler(rustplus: any, client: DiscordBot, message: string | null = null): Promise<void> {
    const guildId = rustplus.guildId;
    const generalSettings = rustplus.generalSettings;
    const commandDelayMs = parseInt(generalSettings.commandDelay) * 1000;
    const trademark = generalSettings.trademark;
    const trademarkString = trademark === 'NOT SHOWING' ? '' : `${trademark} | `;
    const messageMaxLength = Constants.MAX_LENGTH_TEAM_MESSAGE - trademarkString.length;

    /* Time to write a message from the queue. If message === null, that means that its a timer call. */
    if (message === null) {
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
    }
    else {
        if (message.length > messageMaxLength) {
            rustplus.log(client.intlGet(guildId, 'warningCap'),
                client.intlGet(guildId, 'messageTooLong', {
                    length: message.length,
                    maxLength: messageMaxLength,
                }));
            return;
        }

        const trademarkedMessage = `${trademarkString}${message}`;

        if (rustplus.inGameChatTimeout === null) {
            rustplus.updateBotMessages(trademarkedMessage);

            await rustplus.sendTeamMessageAsync(trademarkedMessage);
            rustplus.log(client.intlGet(guildId, 'messageCap'), trademarkedMessage);

            rustplus.inGameChatTimeout = setTimeout(() => {
                inGameChatHandler(rustplus, client, null);
            }, commandDelayMs);
        }
        else {
            rustplus.inGameChatQueue.push(trademarkedMessage);
        }
    }
}
