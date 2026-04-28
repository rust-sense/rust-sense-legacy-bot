import type { PlayerNameType } from './Player.js';

export interface ChannelIds {
    category: string | null;
    information: string | null;
    servers: string | null;
    settings: string | null;
    commands: string | null;
    events: string | null;
    teamchat: string | null;
    switches: string | null;
    switchGroups: string | null;
    alarms: string | null;
    storageMonitors: string | null;
    activity: string | null;
    trackers: string | null;
}

export interface InformationMessageIds {
    map: string | null;
    server: string | null;
    event: string | null;
    team: string | null;
    battlemetricsPlayers: string | null;
}

export interface Blacklist {
    discordIds: string[];
    steamIds: string[];
}

export interface Whitelist {
    steamIds: string[];
}

export interface Alias {
    index: number;
    alias: string;
    value: string;
}

export interface MarketSubscriptionList {
    all: string[];
    buy: string[];
    sell: string[];
}

export interface GeneralSettings {
    prefix: string;
    language: string;
    voiceGender: string;
    commandDelay: string;
    trademark: string;
    teammateNameType: PlayerNameType;
    pollingIntervalMs: number;
    reconnectIntervalMs: number;
    showCallStackError: boolean;
    inGameCommandsEnabled?: boolean;
    muteInGameBotMessages?: boolean;
    connectionNotify?: boolean;
    afkNotify?: boolean;
    deathNotify?: boolean;
    fcmAlarmNotificationEnabled?: boolean;
    fcmAlarmNotificationEveryone?: boolean;
    smartAlarmNotifyInGame?: boolean;
    smartSwitchNotifyInGameWhenChangedFromDiscord?: boolean;
    leaderCommandEnabled?: boolean;
    leaderCommandOnlyForPaired?: boolean;
    mapWipeNotifyEveryone?: boolean;
    itemAvailableInVendingMachineNotifyInGame?: boolean;
    displayInformationBattlemetricsAllOnlinePlayers?: boolean;
    battlemetricsGlobalLogin?: boolean;
    battlemetricsGlobalLogout?: boolean;
    battlemetricsGlobalNameChanges?: boolean;
    battlemetricsServerNameChanges?: boolean;
    battlemetricsTrackerNameChanges?: boolean;
    inGameCommandAccessMode?: string;
    [key: string]: unknown;
}

export interface NotificationSettings {
    [key: string]: {
        [key: string]: boolean | string | number;
    };
}

export interface Instance {
    firstTime: boolean;
    role: string | null;
    adminRole: string | null;
    generalSettings: GeneralSettings;
    notificationSettings: NotificationSettings;
    channelId: ChannelIds;
    informationMessageId: InformationMessageIds;
    activeServer: string | null;
    serverList: Record<string, Server>;
    serverListLite: Record<string, ServerLite>;
    trackers: Record<string, Tracker>;
    marketSubscriptionList: MarketSubscriptionList;
    marketBlacklist: string[];
    teamChatColors: Record<string, string>;
    blacklist: Blacklist;
    whitelist: Whitelist;
    aliases: Alias[];
    customIntlMessages: Record<string, string>;
}

export interface ServerLiteEntry {
    serverIp: string;
    appPort: number;
    steamId: string;
    playerToken: string;
}

export interface ServerLite {
    [steamId: string]: ServerLiteEntry;
}

export interface Tracker {
    id: number;
    name: string;
    battlemetricsId: string;
    status: boolean;
    lastScreenshot: string | null;
    lastOnline: string | null;
    lastWipe: string | null;
    messageId: string | null;
    clanTag: string | null;
    everyone: boolean;
    inGame: boolean;
    img?: string;
    title?: string;
    serverId?: string;
    players: Array<{ name?: string; steamId: string | null; playerId: string | null }>;
    serverEvaluation?: any;
    nameChangedPlayers?: any;
    newPlayers?: any;
    loginPlayers?: any;
    logoutPlayers?: any;
}

export interface Marker {
    x: number;
    y: number;
    location: string;
}

export interface SmartSwitch {
    id: number;
    name: string;
    active: boolean;
    reachable: boolean;
    location: string | null;
    x: number | null;
    y: number | null;
    image: string | null;
    command: string;
    autoDayNightOnOff: number;
    proximity: number;
    messageId: string | null;
    serverId?: string;
    everyone?: boolean;
    server?: string;
}

export interface SmartAlarm {
    id: number;
    name: string;
    active: boolean;
    reachable: boolean;
    location: string | null;
    x: number | null;
    y: number | null;
    image: string | null;
    message: string;
    command: string;
    lastTrigger: number | null;
    inGame: boolean;
    messageId: string | null;
    everyone: boolean;
    server?: string;
}

export interface StorageMonitorItem {
    itemId: number;
    quantity: number;
}

export interface StorageMonitor {
    id: number;
    name: string;
    type: 'toolCupboard' | 'vendingMachine' | 'largeWoodBox' | null;
    image: string | null;
    reachable: boolean;
    location: string | null;
    x: number | null;
    y: number | null;
    items: StorageMonitorItem[];
    capacity: number | null;
    decaying: boolean | null;
    inGame: boolean | null;
    messageId: string | null;
    everyone: boolean;
    server?: string;
    upkeep?: string | null;
}

export interface SwitchGroup {
    id: number;
    name: string;
    switches: number[];
    active: boolean;
    image: string | null;
    command: string;
    serverId: string;
    messageId: string | null;
}

export interface CustomCameraGroup {
    id: number;
    name: string;
    cameras: string[];
}

export interface Server {
    serverId: string;
    title: string;
    serverIp: string;
    appPort: number;
    steamId: string;
    playerToken: string;
    battlemetricsId: string | null;
    switches: Record<number, SmartSwitch>;
    alarms: Record<number, SmartAlarm>;
    storageMonitors: Record<number, StorageMonitor>;
    markers: Record<string, Marker>;
    switchGroups: Record<number, SwitchGroup>;
    customCameraGroups: Record<number, CustomCameraGroup>;
    notes: Record<number, string>;
    cargoShipEgressTimeMs: number;
    oilRigLockedCrateUnlockTimeMs: number;
    deepSeaMinWipeCooldownMs: number;
    deepSeaMaxWipeCooldownMs: number;
    deepSeaWipeDurationMs: number;
    timeTillDay: number | null;
    timeTillNight: number | null;
    messageId: string | null;
    connect?: string;
    img?: string;
    url?: string;
    description?: string;
    team?: any;
    leaderRustPlusInstance?: any;
    generalSettings?: any;
    log?: any;
    guildId?: string;
}

export interface Credentials {
    hoster: string | null;
}
