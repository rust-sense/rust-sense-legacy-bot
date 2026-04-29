import { loadJsonResourceSync } from './filesystemUtils.js';

export type StreamerModeUsernamesContent = {
    streamerModeUsernames: string[];
};

const { streamerModeUsernames } = loadJsonResourceSync<StreamerModeUsernamesContent>(
    'staticFiles/streamerModeUsernames.json',
);

const MAGIC_CONSTANT = 2147483647n;
const LOOKUP_CACHE_MAX_SIZE = 10_000;

const LOOKUP_CACHE = new Map<string, string>();

function bigIntMod(a: bigint, b: bigint) {
    return ((a % b) + b) % b;
}

function calculateStreamerModeUsername(steamId64String: string) {
    if (streamerModeUsernames.length === 0) {
        return steamId64String;
    }

    const modMagic = bigIntMod(BigInt(steamId64String), MAGIC_CONSTANT);
    const modLength = bigIntMod(modMagic, BigInt(streamerModeUsernames.length));
    const idx = Number(modLength);

    const username = streamerModeUsernames[idx];
    if (!username) return steamId64String;

    if (LOOKUP_CACHE.size >= LOOKUP_CACHE_MAX_SIZE) {
        LOOKUP_CACHE.delete(LOOKUP_CACHE.keys().next().value!);
    }
    LOOKUP_CACHE.set(steamId64String, username);

    return username;
}

export function getStreamerModeUsername(steamId64String: string) {
    return LOOKUP_CACHE.get(steamId64String) ?? calculateStreamerModeUsername(steamId64String);
}
