import { Readable } from 'node:stream';
import getStaticFilesStorage from '../../util/getStaticFilesStorage.js';
import { loadJsonResourceSync } from '../../utils/filesystemUtils.js';
import type { TTSProvider, VoiceOption } from '../TTSProvider.js';

type ActorParams = { EID: string; LID: string; VID: string };

const Actors = getStaticFilesStorage().getDatasetObject('actors') as Record<string, Record<string, ActorParams | null>>;

const ActorNames = loadJsonResourceSync<Record<string, Record<string, string | null>>>('staticFiles/actors.json');

export class OddcastProvider implements TTSProvider {
    getVoices(language: string): VoiceOption[] {
        const langActors = Actors[language];
        if (!langActors) return [];

        return Object.entries(langActors)
            .filter(([, params]) => params !== null)
            .map(([gender]) => {
                const name = ActorNames[language]?.[gender];
                const genderLabel = gender.charAt(0).toUpperCase() + gender.slice(1);
                return {
                    label: name ? `${name} (${genderLabel})` : genderLabel,
                    value: gender,
                };
            });
    }

    async synthesize(text: string, language: string, voice: string): Promise<Readable> {
        const langActors = Actors[language];
        if (!langActors) throw new Error(`Unsupported Oddcast language: ${language}`);

        let params = langActors[voice] ?? null;
        if (params === null) {
            const fallback = voice === 'male' ? 'female' : 'male';
            params = langActors[fallback] ?? null;
        }
        if (!params) throw new Error(`No Oddcast actor found for language ${language}`);

        const url = `https://cache-a.oddcast.com/tts/genC.php?EID=${params.EID}&LID=${params.LID}&VID=${params.VID}&TXT=${encodeURIComponent(text)}&EXT=mp3`;
        const response = await fetch(url);
        return Readable.fromWeb(response.body as any);
    }
}
