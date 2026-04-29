import { Readable } from 'node:stream';
import { createAudioPlayer, createAudioResource, getVoiceConnection } from '@discordjs/voice';

import { client } from '../index.js';
import getStaticFilesStorage from '../util/getStaticFilesStorage.js';

const Actors = getStaticFilesStorage().getDatasetObject('actors') as Record<
    string,
    Record<string, { EID: string; LID: string; VID: string } | null>
>;

export async function sendDiscordVoiceMessage(guildId: string, text: string) {
    const connection = getVoiceConnection(guildId);
    if (!connection) return;

    const voice = await getVoice(guildId);
    if (!voice) return;

    const url = `https://cache-a.oddcast.com/tts/genC.php?EID=${voice.EID}&LID=${voice.LID}&VID=${voice.VID}&TXT=${encodeURIComponent(text)}&EXT=mp3`;

    try {
        const stream = Readable.fromWeb((await (await fetch(url)).blob()).stream());
        const resource = createAudioResource(stream);
        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);
    } catch (e) {
        client.log('ERROR', `Failed to play TTS in voice channel for guild ${guildId}: ${e}`, 'error');
    }
}

export async function getVoice(guildId: string) {
    const instance = client.getInstance(guildId);
    const gender = instance.generalSettings.voiceGender;
    const language = instance.generalSettings.language;

    if (Actors[language]?.[gender] === null || Actors[language]?.[gender] === undefined) {
        return Actors[language]?.[gender === 'male' ? 'female' : 'male'];
    }

    return Actors[language]?.[gender];
}
