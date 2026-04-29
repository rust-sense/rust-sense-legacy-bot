import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { client } from '../../index.js';
import type { TTSProvider, VoiceOption } from '../TTSProvider.js';

const MODELS_DIR = '/app/models';

// Cached for the process lifetime; reset on error so the next call retries.
let _voiceKeysCachePromise: Promise<string[]> | null = null;

function fetchAllVoiceKeys(): Promise<string[]> {
    if (!_voiceKeysCachePromise) {
        _voiceKeysCachePromise = new Promise<string[]>((resolve, reject) => {
            const child = spawn('python3', ['-m', 'piper.download_voices']);
            let stdout = '';
            child.stdout.on('data', (d: Buffer) => {
                stdout += d.toString();
            });
            child.on('error', reject);
            child.on('close', (code) => {
                if (code !== 0 && !stdout.trim()) {
                    reject(new Error(`piper.download_voices exited with code ${code}`));
                    return;
                }
                const keys = stdout
                    .trim()
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean);
                resolve(keys);
            });
        }).catch((e) => {
            _voiceKeysCachePromise = null;
            throw e;
        });
    }
    return _voiceKeysCachePromise;
}

export class PiperProvider implements TTSProvider {
    async getVoices(language: string): Promise<VoiceOption[]> {
        let keys: string[];
        try {
            keys = await fetchAllVoiceKeys();
        } catch (e) {
            client.log('ERROR', `Failed to fetch Piper voice list: ${e}`, 'error');
            return [];
        }

        const voices: VoiceOption[] = [];
        for (const key of keys) {
            // key format: en_US-lessac-medium
            const match = key.match(/^([a-z]{2})_[A-Z]+-(.+)-(\w+)$/);
            if (!match || match[1] !== language) continue;
            const name = match[2];
            const quality = match[3];
            voices.push({
                label: `${name.charAt(0).toUpperCase()}${name.slice(1)} (${quality})`,
                value: key,
            });
        }

        return voices.sort((a, b) => a.label.localeCompare(b.label)).slice(0, 25);
    }

    async synthesize(text: string, language: string, voice: string): Promise<Readable> {
        const voices = await this.getVoices(language);
        if (voices.length === 0) {
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
            const child = spawn('piper', ['--model', modelPath, '--data-dir', MODELS_DIR, '--output_file', wavPath]);

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
            const child = spawn('python3', ['-m', 'piper.download_voices', voiceName, '--data-dir', MODELS_DIR]);

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
