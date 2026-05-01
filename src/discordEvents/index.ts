import errorEventHandler from './error.js';
import guildCreateEventHandler from './guildCreate.js';
import guildDeleteEventHandler from './guildDelete.js';
import guildMemberRemoveEventHandler from './guildMemberRemove.js';
import interactionCreateEventHandler from './interactionCreate.js';
import messageCreateEventHandler from './messageCreate.js';
import rateLimitedEventHandler from './rateLimited.js';
import readyEventHandler from './ready.js';
import voiceStateUpdateEventHandler from './voiceStateUpdate.js';

export default [
    errorEventHandler,
    guildCreateEventHandler,
    guildDeleteEventHandler,
    guildMemberRemoveEventHandler,
    interactionCreateEventHandler,
    messageCreateEventHandler,
    rateLimitedEventHandler,
    readyEventHandler,
    voiceStateUpdateEventHandler,
];
