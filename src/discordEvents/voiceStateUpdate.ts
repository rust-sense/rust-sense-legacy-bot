import { getVoiceConnection } from '@discordjs/voice';
import { destroyGuildTTS } from '../discordTools/discordVoice.js';
import type DiscordBot from '../structures/DiscordBot.js';
import * as Constants from '../util/constants.js';

export default {
    name: 'voiceStateUpdate',
    execute(client: DiscordBot, oldState: any, newState: any) {
        checkBotLeaveVoice(client, oldState, newState);
    },
};
function checkBotLeaveVoice(client: DiscordBot, oldState: any, newState: any) {
    const guildId = oldState.guild.id;

    if (!Object.hasOwn(client.voiceLeaveTimeouts, guildId)) client.voiceLeaveTimeouts[guildId] = null;

    /* No channel involved. */
    if (oldState.channel === null && newState.channel === null) return;

    const connection = getVoiceConnection(guildId);
    if (!connection) return; /* Bot is not in any voice channel. */

    const botChannelId = connection.joinConfig.channelId;
    const memberId = oldState.member.id;

    /* If user join same channel as bot */
    if (memberId !== client.user.id && newState.channel !== null && newState.channel.id === botChannelId) {
        clearTimeout(client.voiceLeaveTimeouts[guildId]);
        return;
    }

    let condition = false;
    let channel = null;

    /* If user was in same channel as bot, but not anymore */
    if (
        memberId !== client.user.id &&
        oldState.channel !== null &&
        oldState.channel.id === botChannelId &&
        (newState.channel === null || (newState.channel !== null && newState.channel.id !== botChannelId))
    ) {
        condition = true;
        channel = oldState.channel;
    }

    if (memberId === client.user.id) {
        condition = true;
        channel = newState.channel;
    }

    if (condition && channel && channel.members.size === 1) {
        client.voiceLeaveTimeouts[guildId] = setTimeout(
            botLeaveVoiceTimeout.bind(null, guildId),
            Constants.BOT_LEAVE_VOICE_CHAT_TIMEOUT_MS,
        );
    }
}

function botLeaveVoiceTimeout(guildId: string) {
    const connection = getVoiceConnection(guildId);
    if (connection) {
        connection.destroy();
    }

    destroyGuildTTS(guildId);
}
