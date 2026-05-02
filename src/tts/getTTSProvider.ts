import { client } from '../index.js';
import { getPersistenceCache } from '../persistence/index.js';
import { OddcastProvider } from './providers/OddcastProvider.js';
import { PiperProvider } from './providers/PiperProvider.js';
import type { TTSProvider } from './TTSProvider.js';

export async function getTTSProvider(guildId: string): Promise<TTSProvider> {
    const { ttsProvider } = (await getPersistenceCache().readGuildState(guildId)).generalSettings;
    if (ttsProvider === 'piper') return new PiperProvider();
    return new OddcastProvider();
}
