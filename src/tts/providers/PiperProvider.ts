import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import path from 'node:path';

import { client } from '../../index.js';
import type { TTSProvider, VoiceOption } from '../TTSProvider.js';

const MODELS_DIR = '/app/models';

const VOICES_BY_LANG: Record<string, VoiceOption[]> = {
    en: [
        { label: 'Lessac', value: 'en_US-lessac-medium' },
        { label: 'Joe', value: 'en_US-joe-medium' },
        { label: 'John', value: 'en_US-john-medium' },
    ],
    es: [
        { label: 'Sharvard', value: 'es_ES-sharvard-medium' },
        { label: 'Davefx', value: 'es_ES-davefx-medium' },
    ],
    fr: [
        { label: 'Siwis', value: 'fr_FR-siwis-medium' },
        { label: 'Tom', value: 'fr_FR-tom-medium' },
    ],
    de: [
        { label: 'Thorsten', value: 'de_DE-thorsten-medium' },
        { label: 'MLS', value: 'de_DE-mls-medium' },
    ],
    it: [
        { label: 'Paola', value: 'it_IT-paola-medium' },
        { label: 'Riccardo', value: 'it_IT-riccardo-medium' },
    ],
    ru: [
        { label: 'Irina', value: 'ru_RU-irina-medium' },
        { label: 'Denis', value: 'ru_RU-denis-medium' },
    ],
};

export class PiperProvider implements TTSProvider {
    getVoices(language: string): VoiceOption[] {
        return VOICES_BY_LANG[language] ?? [];
    }

    async synthesize(text: string, language: string, voice: string): Promise<Readable> {
        const voices = VOICES_BY_LANG[language];
        if (!voices || voices.length === 0) {
            throw new Error(`Piper TTS does not support language: ${language}`);
        }

        const modelPath = path.join(MODELS_DIR, `${voice}.onnx`);

        try {
            await access(modelPath);
        } catch {
            await this.downloadModel(voice);
        }

        await mkdir('/tmp/tts', { recursive: true });
        const wavPath = path.join('/tmp/tts', `${randomUUID()}.wav`);

        await new Promise<void>((resolve, reject) => {
            const child = spawn('piper', [
                '--model', modelPath,
                '--data-dir', MODELS_DIR,
                '--output_file', wavPath,
            ]);

            child.stdin.write(text);
            child.stdin.end();

            child.stderr.on('data', (data) => {
                client.log('INFO', `Piper: ${data.toString().trim()}`, 'info');
            });

            child.on('error', reject);
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Piper exited with code ${code}`));
            });
        });

        const stream = createReadStream(wavPath);
        stream.on('close', () => {
            unlink(wavPath).catch(() => {});
        });
        return stream;
    }

    private async downloadModel(voiceName: string): Promise<void> {
        client.log('INFO', `Downloading Piper model: ${voiceName}`, 'info');

        await new Promise<void>((resolve, reject) => {
            const child = spawn('python3', [
                '-m', 'piper.download_voices',
                voiceName,
                '--data-dir', MODELS_DIR,
            ]);

            child.stderr.on('data', (data) => {
                client.log('INFO', `Piper download: ${data.toString().trim()}`, 'info');
            });

            child.on('error', reject);
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Piper model download failed with code ${code}`));
            });
        });
    }
}
