import { AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection } from '@discordjs/voice';

import { client } from '../index.js';
import { getPersistenceCache } from '../persistence/index.js';
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
    if (!queue || queue.length === 0) {
        client.log('INFO', `TTS queue empty for guild ${guildId}`, 'info');
        return;
    }

    const resource = queue.shift()!;
    const player = ttsPlayers.get(guildId);
    if (!player) return;

    client.log('INFO', `Playing next TTS for guild ${guildId} (${queue.length} remaining in queue)`, 'info');
    player.play(resource);
}

function getOrCreatePlayer(guildId: string) {
    let player = ttsPlayers.get(guildId);
    if (!player) {
        player = createAudioPlayer();
        player.on(AudioPlayerStatus.Idle, () => {
            client.log('INFO', `AudioPlayer Idle for guild ${guildId}`, 'info');
            playNext(guildId);
        });
        player.on(AudioPlayerStatus.Playing, () => {
            client.log('INFO', `AudioPlayer Playing for guild ${guildId}`, 'info');
        });
        player.on(AudioPlayerStatus.Buffering, () => {
            client.log('INFO', `AudioPlayer Buffering for guild ${guildId}`, 'info');
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

    const { language, voiceGender, ttsProvider, piperVoice } = (await getPersistenceCache().readGuildState(guildId))
        .generalSettings;
    const voice = ttsProvider === 'piper' ? piperVoice : voiceGender;

    try {
        client.log('INFO', `Synthesizing TTS for guild ${guildId}: "${text.substring(0, 50)}..."`, 'info');
        const provider = await getTTSProvider(guildId);
        const stream = await provider.synthesize(text, language, voice);
        client.log('INFO', `TTS synthesis complete for guild ${guildId}`, 'info');
        const resource = createAudioResource(stream as any, { inputType: provider.streamType });

        const player = getOrCreatePlayer(guildId);
        connection.subscribe(player);

        let queue = ttsQueues.get(guildId);
        if (!queue) {
            queue = [];
            ttsQueues.set(guildId, queue);
        }
        queue.push(resource);
        client.log(
            'INFO',
            `TTS queued for guild ${guildId} (queue length: ${queue.length}, player status: ${player.state.status})`,
            'info',
        );

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
