import errorEventHandler from './error';
import guildCreateEventHandler from './guildCreate';
import guildMemberRemoveEventHandler from './guildMemberRemove';
import interactionCreateEventHandler from './interactionCreate';
import messageCreateEventHandler from './messageCreate';
import rateLimitedEventHandler from './rateLimited';
import readyEventHandler from './ready';
import voiceStateUpdateEventHandler from './voiceStateUpdate';

export default [
    errorEventHandler,
    guildCreateEventHandler,
    guildMemberRemoveEventHandler,
    interactionCreateEventHandler,
    messageCreateEventHandler,
    rateLimitedEventHandler,
    readyEventHandler,
    voiceStateUpdateEventHandler,
];
