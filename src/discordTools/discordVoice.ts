import { createAudioPlayer, createAudioResource, getVoiceConnection } from '@discordjs/voice';

import { client } from '../index.js';
import { getTTSProvider } from '../tts/getTTSProvider.js';

export async function sendDiscordVoiceMessage(guildId: string, text: string) {
    const connection = getVoiceConnection(guildId);
    if (!connection) return;

    const { language, voiceGender, ttsProvider, piperVoice } = client.getInstance(guildId).generalSettings;
    const voice = ttsProvider === 'piper' ? piperVoice : voiceGender;

    try {
        const stream = await getTTSProvider(guildId).synthesize(text, language, voice);
        const resource = createAudioResource(stream as any);
        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);
    } catch (e) {
        client.log('ERROR', `Failed to play TTS in voice channel for guild ${guildId}: ${e}`, 'error');
    }
}
