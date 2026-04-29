import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    getVoiceConnection,
    StreamType,
} from '@discordjs/voice';

import { client } from '../index.js';
import { getTTSProvider } from '../tts/getTTSProvider.js';

const ttsPlayers = new Map<string, ReturnType<typeof createAudioPlayer>>();
const ttsQueues = new Map<string, Array<ReturnType<typeof createAudioResource>>>();

function cleanupGuildTTS(guildId: string) {
    const player = ttsPlayers.get(guildId);
    if (player) {
        player.stop(true);
        ttsPlayers.delete(guildId);
    }
    ttsQueues.delete(guildId);
}

function playNext(guildId: string) {
    const queue = ttsQueues.get(guildId);
    if (!queue || queue.length === 0) return;

    const resource = queue.shift()!;
    const player = ttsPlayers.get(guildId);
    if (!player) return;

    player.play(resource);
}

function getOrCreatePlayer(guildId: string) {
    let player = ttsPlayers.get(guildId);
    if (!player) {
        player = createAudioPlayer();
        player.on(AudioPlayerStatus.Idle, () => {
            playNext(guildId);
        });
        player.on('error', (err) => {
            client.log('ERROR', `Audio player error for guild ${guildId}: ${err.message}`, 'error');
            playNext(guildId);
        });
        ttsPlayers.set(guildId, player);
    }
    return player;
}

export async function sendDiscordVoiceMessage(guildId: string, text: string) {
    const connection = getVoiceConnection(guildId);
    if (!connection) return;

    const { language, voiceGender, ttsProvider, piperVoice } = client.getInstance(guildId).generalSettings;
    const voice = ttsProvider === 'piper' ? piperVoice : voiceGender;

    try {
        const stream = await getTTSProvider(guildId).synthesize(text, language, voice);
        const resource = createAudioResource(stream as any, { inputType: StreamType.OggOpus });

        const player = getOrCreatePlayer(guildId);
        connection.subscribe(player);

        let queue = ttsQueues.get(guildId);
        if (!queue) {
            queue = [];
            ttsQueues.set(guildId, queue);
        }
        queue.push(resource);

        if (player.state.status === AudioPlayerStatus.Idle) {
            playNext(guildId);
        }
    } catch (e) {
        client.log('ERROR', `Failed to play TTS in voice channel for guild ${guildId}: ${e}`, 'error');
    }
}

export function destroyGuildTTS(guildId: string) {
    cleanupGuildTTS(guildId);
}
