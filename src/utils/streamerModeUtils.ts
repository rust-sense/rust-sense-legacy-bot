import { loadJsonResourceSync } from './filesystemUtils';

export type StreamerModeUsernamesContent = {
    streamerModeUsernames: string[];
};

const { streamerModeUsernames } = loadJsonResourceSync<StreamerModeUsernamesContent>(
    'staticFiles/streamerModeUsernames.json',
);

const MAGIC_CONSTANT = 2147483647n;

const LOOKUP_CACHE = new Map<string, string>();

function bigIntMod(a: bigint, b: bigint) {
    return ((a % b) + b) % b;
}

function calculateStreamerModeUsername(steamId64String: string) {
    const modMagic = bigIntMod(BigInt(steamId64String), MAGIC_CONSTANT);
    const modLength = bigIntMod(modMagic, BigInt(streamerModeUsernames.length));
    const idx = Number(modLength);

    const username = streamerModeUsernames[idx];
    LOOKUP_CACHE.set(steamId64String, username);

    return username;
}

export function getStreamerModeUsername(steamId64String: string) {
    return LOOKUP_CACHE.get(steamId64String) ?? calculateStreamerModeUsername(steamId64String);
}
