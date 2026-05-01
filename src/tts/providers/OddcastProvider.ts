import { Readable } from 'node:stream';
import { StreamType } from '@discordjs/voice';
import getStaticFilesStorage from '../../util/getStaticFilesStorage.js';
import type { TTSProvider, VoiceOption } from '../TTSProvider.js';

type ActorParams = { EID: string; LID: string; VID: string };

const Actors = getStaticFilesStorage().getDatasetObject('actors') as Record<string, Record<string, ActorParams | null>>;

const ACTOR_NAMES: Record<string, Record<string, string | null>> = {
    cs: { male: null, female: 'Aleksandra' },
    de: { male: 'Albert', female: 'Nina' },
    en: { male: 'Brian', female: 'Joanna' },
    es: { male: 'Miguel', female: 'Mia' },
    fr: { male: 'Mathieu', female: 'Emilie' },
    it: { male: 'Luca', female: 'Stella' },
    ko: { male: null, female: 'Seoyeon' },
    pl: { male: 'Jacek', female: 'Maja' },
    ru: { male: 'Maxim', female: 'Tatyana' },
    sv: { male: null, female: 'Astrid' },
    tr: { male: 'Mehmet', female: 'Miray' },
};

export class OddcastProvider implements TTSProvider {
    readonly streamType = StreamType.Arbitrary;

    async getVoices(language: string): Promise<VoiceOption[]> {
        const langActors = Actors[language];
        if (!langActors) return [];

        return Object.entries(langActors)
            .filter(([, params]) => params !== null)
            .map(([gender]) => {
                const name = ACTOR_NAMES[language]?.[gender];
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
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Oddcast TTS request failed with ${response.status}: ${body.slice(0, 200)}`);
        }
        if (!response.body) {
            throw new Error('Oddcast TTS response did not include an audio body');
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/') || contentType.includes('json')) {
            const body = await response.text();
            throw new Error(`Oddcast TTS returned non-audio content (${contentType}): ${body.slice(0, 200)}`);
        }
        return Readable.fromWeb(response.body as any);
    }
}
