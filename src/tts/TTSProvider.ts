import type { Readable } from 'node:stream';
import type { StreamType } from '@discordjs/voice';

export interface VoiceOption {
    label: string;
    value: string;
}

export interface TTSProvider {
    readonly streamType: StreamType;
    synthesize(text: string, language: string, voice: string): Promise<Readable>;
    getVoices(language: string): Promise<VoiceOption[]>;
}
