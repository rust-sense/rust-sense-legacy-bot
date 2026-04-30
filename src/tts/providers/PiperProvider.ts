import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { client } from '../../index.js';
import type { TTSProvider, VoiceOption } from '../TTSProvider.js';

const MODELS_DIR = '/app/models';
const PROCESS_TIMEOUT_MS = 30000;

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

        const piper = spawn('piper', ['--model', modelPath, '--data-dir', MODELS_DIR, '--output_raw']);

        const ffmpeg = spawn('ffmpeg', [
            '-f',
            's16le',
            '-ar',
            '22050',
            '-ac',
            '1',
            '-i',
            'pipe:0',
            '-c:a',
            'libopus',
            '-application',
            'voip',
            '-f',
            'ogg',
            'pipe:1',
        ]);

        piper.stdout.pipe(ffmpeg.stdin);

        const chunks: Buffer[] = [];
        let intentionallyKilled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        function cleanup() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            intentionallyKilled = true;
            piper.kill();
            ffmpeg.kill();
        }

        timeoutId = setTimeout(() => {
            client.log('ERROR', 'Piper/FFmpeg TTS synthesis timed out', 'error');
            cleanup();
        }, PROCESS_TIMEOUT_MS);

        piper.on('error', (err) => {
            if (intentionallyKilled) return;
            client.log('ERROR', `Piper process error: ${err.message}`, 'error');
            cleanup();
        });

        piper.stderr.on('data', (data) => {
            client.log('INFO', `Piper: ${data.toString().trim()}`, 'info');
        });

        piper.on('close', (code) => {
            if (intentionallyKilled) return;
            if (code !== 0 && code !== null) {
                client.log('ERROR', `Piper exited with code ${code}`, 'error');
                cleanup();
            }
        });

        ffmpeg.on('error', (err) => {
            if (intentionallyKilled) return;
            client.log('ERROR', `FFmpeg process error: ${err.message}`, 'error');
            cleanup();
        });

        if (ffmpeg.stdout) {
            ffmpeg.stdout.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
        }

        if (ffmpeg.stderr) {
            ffmpeg.stderr.on('data', (data) => {
                const line = data.toString().trim();
                if (line.toLowerCase().startsWith('error')) {
                    client.log('ERROR', `FFmpeg: ${line}`, 'error');
                }
            });
        }

        piper.stdin.write(text);
        piper.stdin.end();

        await new Promise<void>((resolve, reject) => {
            ffmpeg.on('close', (code) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (code === 0 || code === null) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });

        if (intentionallyKilled) {
            throw new Error('TTS synthesis was killed');
        }

        const buffer = Buffer.concat(chunks);
        return Readable.from(buffer);
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
