/*
    Copyright (C) 2026 FaiThiX

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/faithix/rustplusplus

*/

import * as Constants from './constants.js';

function normalizeInput(input: unknown): string {
    if (typeof input !== 'string') return '';

    let normalized = input.trim();

    if (normalized.startsWith('<') && normalized.endsWith('>')) {
        normalized = normalized.slice(1, -1).trim();
    }

    return normalized;
}

function isSteamId64(input: string): boolean {
    return new RegExp(`^\\d{${Constants.STEAMID64_LENGTH}}$`).test(input);
}

function isBattlemetricsPlayerId(input: string): boolean {
    return /^\d+$/.test(input);
}

function parseSteamProfileUrl(pathname: string): string | null {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0]?.toLowerCase() !== 'profiles') return null;

    const steamId = parts[1];
    if (!steamId) return null;
    return isSteamId64(steamId) ? steamId : null;
}

function parseSteamVanityUrl(pathname: string): string | null {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0]?.toLowerCase() !== 'id') return null;

    const vanity = parts[1]?.trim();
    if (!vanity || vanity === '') return null;

    return vanity;
}

function parseBattlemetricsPlayerUrl(pathname: string): string | null {
    const parts = pathname.split('/').filter(Boolean);
    const playersIndex = parts.findIndex((part) => part.toLowerCase() === 'players');
    if (playersIndex === -1) return null;
    
    const playerId = parts[playersIndex + 1];
    if (!playerId) return null;
    
    return isBattlemetricsPlayerId(playerId) ? playerId : null;
}

export interface TrackerInputResult {
    valid: boolean;
    value: string | null;
    type: string | null;
    normalizedInput: string;
}

export function parseTrackerPlayerInput(input: unknown): TrackerInputResult {
    const normalizedInput = normalizeInput(input);

    if (normalizedInput === '') {
        return { valid: false, value: null, type: null, normalizedInput };
    }

    if (isSteamId64(normalizedInput)) {
        return { valid: true, value: normalizedInput, type: 'steamId', normalizedInput };
    }

    if (isBattlemetricsPlayerId(normalizedInput)) {
        return {
            valid: true,
            value: normalizedInput,
            type: 'battlemetricsId',
            normalizedInput,
        };
    }

    let url: URL | null = null;
    try {
        url = new URL(normalizedInput);
    } catch (_e) {
        return { valid: false, value: null, type: null, normalizedInput };
    }

    const hostname = url.hostname.toLowerCase();

    if (hostname === 'steamcommunity.com' || hostname === 'www.steamcommunity.com') {
        const steamId = parseSteamProfileUrl(url.pathname);
        if (steamId) {
            return { valid: true, value: steamId, type: 'steamId', normalizedInput };
        }

        const vanity = parseSteamVanityUrl(url.pathname);
        if (vanity) {
            return {
                valid: true,
                value: vanity,
                type: 'steamVanityUrl',
                normalizedInput,
            };
        }

        return { valid: false, value: null, type: null, normalizedInput };
    }

    if (
        hostname === 'battlemetrics.com' ||
        hostname === 'www.battlemetrics.com' ||
        hostname === 'api.battlemetrics.com'
    ) {
        const battlemetricsId = parseBattlemetricsPlayerUrl(url.pathname);
        if (!battlemetricsId) {
            return { valid: false, value: null, type: null, normalizedInput };
        }

        return {
            valid: true,
            value: battlemetricsId,
            type: 'battlemetricsId',
            normalizedInput,
        };
    }

    return { valid: false, value: null, type: null, normalizedInput };
}
