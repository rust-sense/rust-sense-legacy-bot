import type { Readable } from 'node:stream';

export interface VoiceOption {
    label: string;
    value: string;
}

export interface TTSProvider {
    synthesize(text: string, language: string, voice: string): Promise<Readable>;
    getVoices(language: string): Promise<VoiceOption[]>;
}
