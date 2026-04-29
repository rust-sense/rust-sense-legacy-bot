import { client } from '../index.js';
import { OddcastProvider } from './providers/OddcastProvider.js';
import { PiperProvider } from './providers/PiperProvider.js';
import type { TTSProvider } from './TTSProvider.js';

export function getTTSProvider(guildId: string): TTSProvider {
    const { ttsProvider } = client.getInstance(guildId).generalSettings;
    if (ttsProvider === 'piper') return new PiperProvider();
    return new OddcastProvider();
}
