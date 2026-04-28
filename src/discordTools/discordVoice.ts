import { getVoiceConnection, createAudioPlayer, createAudioResource } from '@discordjs/voice';

import { client } from '../index.js';
import getStaticFilesStorage from '../util/getStaticFilesStorage.js';

const Actors = getStaticFilesStorage().getDatasetObject('actors') as Record<string, Record<string, { EID: string; LID: string; VID: string } | null>>;

export async function sendDiscordVoiceMessage(guildId: string, text: string) {
    const connection = getVoiceConnection(guildId);
    const voice = await getVoice(guildId);
    const url = `https://cache-a.oddcast.com/tts/genC.php?EID=${voice.EID}&LID=${voice.LID}&VID=${voice.VID}&TXT=${encodeURIComponent(text)}&EXT=mp3`;

    if (connection) {
        const stream = (await (await fetch(url)).blob()).stream() as any;
        const resource = createAudioResource(stream);
        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);
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