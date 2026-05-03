import type { ChannelIds, Credentials, InformationMessageIds, Tracker } from '../../types/instance.js';

export const CHANNEL_ID_KEYS: Array<[keyof ChannelIds, string]> = [
    ['category', 'channel.category'],
    ['information', 'channel.information'],
    ['servers', 'channel.servers'],
    ['settings', 'channel.settings'],
    ['commands', 'channel.commands'],
    ['events', 'channel.events'],
    ['teamchat', 'channel.teamchat'],
    ['switches', 'channel.switches'],
    ['switchGroups', 'channel.switchGroups'],
    ['alarms', 'channel.alarms'],
    ['storageMonitors', 'channel.storageMonitors'],
    ['activity', 'channel.activity'],
    ['trackers', 'channel.trackers'],
];

export const INFORMATION_MESSAGE_ID_KEYS: Array<[keyof InformationMessageIds, string]> = [
    ['map', 'informationMessage.map'],
    ['server', 'informationMessage.server'],
    ['event', 'informationMessage.event'],
    ['team', 'informationMessage.team'],
    ['battlemetricsPlayers', 'informationMessage.battlemetricsPlayers'],
];

export function dbBool(value: unknown): number {
    return value ? 1 : 0;
}

export function fromDbBool(value: unknown): boolean {
    return value === 1 || value === true;
}

export function credentialEntries(credentials: Credentials): Array<[string, Record<string, unknown>]> {
    return Object.entries(credentials).filter(
        ([steamId, value]) => steamId !== 'hoster' && typeof value === 'object' && value,
    );
}

export function normalizeTracker(trackerKey: string, tracker: Tracker): Tracker {
    return {
        id: tracker.id ?? Number(trackerKey),
        name: tracker.name,
        battlemetricsId: tracker.battlemetricsId,
        status: tracker.status,
        lastScreenshot: tracker.lastScreenshot ?? null,
        lastOnline: tracker.lastOnline ?? null,
        lastWipe: tracker.lastWipe ?? null,
        messageId: tracker.messageId ?? null,
        clanTag: tracker.clanTag ?? null,
        everyone: tracker.everyone,
        inGame: tracker.inGame,
        img: tracker.img,
        title: tracker.title,
        serverId: tracker.serverId,
        players: tracker.players ?? [],
    };
}
