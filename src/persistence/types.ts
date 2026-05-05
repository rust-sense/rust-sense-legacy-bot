import type {
    Alias,
    Blacklist,
    ChannelIds,
    Credentials,
    GeneralSettings,
    InformationMessageIds,
    Instance,
    Marker,
    MarketSubscriptionList,
    NotificationSettings,
    Server,
    ServerLite,
    ServerLiteEntry,
    SmartAlarm,
    SmartSwitch,
    StorageMonitor,
    SwitchGroup,
    Tracker,
    Whitelist,
} from '../types/instance.js';

export type PersistenceAdapterName = 'json' | 'sqlite' | 'postgres';
export type MaybePromise<T> = T | Promise<T>;

export interface DiscordReferenceUpdate {
    key: string;
    value: string | null;
}

export interface GuildSettingUpdate {
    key: string;
    value: string;
}

export interface GuildCorePatch {
    firstTime?: boolean;
    role?: string | null;
    adminRole?: string | null;
    activeServer?: string | null;
}

export interface ServerPatch {
    battlemetricsId?: string | null;
    connect?: string | null;
    cargoShipEgressTimeMs?: number;
    oilRigLockedCrateUnlockTimeMs?: number;
    deepSeaMinWipeCooldownMs?: number;
    deepSeaMaxWipeCooldownMs?: number;
    deepSeaWipeDurationMs?: number;
}

export interface SmartSwitchPatch {
    name?: string;
    active?: boolean;
    reachable?: boolean;
    location?: string | null;
    x?: number | null;
    y?: number | null;
    command?: string;
    autoDayNightOnOff?: number;
    proximity?: number;
    image?: string | null;
    everyone?: boolean | null;
}

export interface SmartAlarmPatch {
    name?: string;
    active?: boolean;
    reachable?: boolean;
    location?: string | null;
    x?: number | null;
    y?: number | null;
    lastTrigger?: number | null;
    message?: string;
    command?: string;
    inGame?: boolean;
    image?: string | null;
    everyone?: boolean;
}

export interface StorageMonitorPatch {
    name?: string;
    reachable?: boolean;
    location?: string | null;
    x?: number | null;
    y?: number | null;
    type?: string | null;
    capacity?: number | null;
    decaying?: boolean | null;
    inGame?: boolean | null;
    image?: string | null;
    everyone?: boolean;
    upkeep?: string | null;
}

export interface SmartSwitchGroupPatch {
    name?: string;
    active?: boolean;
    command?: string;
    image?: string | null;
}

export interface TrackerPatch {
    name?: string;
    battlemetricsId?: string;
    clanTag?: string | null;
    img?: string | null;
    title?: string | null;
    serverId?: string | null;
    everyone?: boolean;
    inGame?: boolean;
}

export type BlacklistEntryType = 'discord' | 'steam';
export type MarketSubscriptionType = keyof MarketSubscriptionList;

export interface GuildCoreState {
    firstTime: boolean;
    role: string | null;
    adminRole: string | null;
    activeServer: string | null;
    channelId: ChannelIds;
    informationMessageId: InformationMessageIds;
}

export interface GuildSettingsState {
    generalSettings: GeneralSettings;
    notificationSettings: NotificationSettings;
}

export interface GuildCollectionsState {
    trackers: Record<string, Tracker>;
    marketSubscriptionList: MarketSubscriptionList;
    marketBlacklist: string[];
    teamChatColors: Record<string, string>;
    blacklist: Blacklist;
    whitelist: Whitelist;
    aliases: Alias[];
    customIntlMessages: Record<string, string>;
}

export interface CompatibilityGuildState extends GuildCoreState, GuildSettingsState, GuildCollectionsState {
    serverList: Record<string, Server>;
}

export interface PersistenceAdapter {
    readonly name: PersistenceAdapterName;
    readonly deprecated?: boolean;

    init(): Promise<void>;
    close(): Promise<void>;
    listGuildIds(): MaybePromise<string[]>;
    hasGuild(guildId: string): MaybePromise<boolean>;
    readGuildCore(guildId: string): MaybePromise<GuildCoreState>;
    updateGuildCoreFields(guildId: string, patch: GuildCorePatch): MaybePromise<void>;
    writeGuildCore(guildId: string, core: GuildCoreState): MaybePromise<void>;
    readGuildSettings(guildId: string): MaybePromise<GuildSettingsState>;
    setGuildSettings(guildId: string, updates: GuildSettingUpdate[]): MaybePromise<void>;
    writeGuildSettings(guildId: string, settings: GuildSettingsState): MaybePromise<void>;
    setDiscordReferencedIds(guildId: string, updates: DiscordReferenceUpdate[]): MaybePromise<void>;
    readServers(guildId: string): MaybePromise<Record<string, Server>>;
    readServerLiteEntries(guildId: string): MaybePromise<Record<string, ServerLite>>;
    replaceServerTimeSamples(
        guildId: string,
        serverId: string,
        timeTillDay: Server['timeTillDay'],
        timeTillNight: Server['timeTillNight'],
    ): MaybePromise<void>;
    setServerMessageId(guildId: string, serverId: string, messageId: string | null): MaybePromise<void>;
    updateServerFields(guildId: string, serverId: string, patch: ServerPatch): MaybePromise<void>;
    upsertServer(guildId: string, serverId: string, server: Server): MaybePromise<void>;
    deleteServer(guildId: string, serverId: string): MaybePromise<void>;
    upsertServerLiteEntry(
        guildId: string,
        serverId: string,
        steamId: string,
        entry: ServerLiteEntry,
    ): MaybePromise<void>;
    upsertMarker(guildId: string, serverId: string, markerKey: string, marker: Marker): MaybePromise<void>;
    deleteMarker(guildId: string, serverId: string, markerKey: string): MaybePromise<void>;
    upsertNote(guildId: string, serverId: string, noteId: string | number, note: string): MaybePromise<void>;
    deleteNote(guildId: string, serverId: string, noteId: string | number): MaybePromise<void>;
    setTrackerMessageId(guildId: string, trackerId: string, messageId: string | null): MaybePromise<void>;
    updateTrackerFields(guildId: string, trackerId: string, patch: TrackerPatch): MaybePromise<void>;
    upsertTracker(guildId: string, trackerId: string, tracker: Tracker): MaybePromise<void>;
    deleteTracker(guildId: string, trackerId: string): MaybePromise<void>;
    replaceTrackerPlayers(guildId: string, trackerId: string, players: Tracker['players']): MaybePromise<void>;
    upsertSmartSwitch(
        guildId: string,
        serverId: string,
        switchId: string,
        smartSwitch: SmartSwitch,
    ): MaybePromise<void>;
    deleteSmartSwitch(guildId: string, serverId: string, switchId: string): MaybePromise<void>;
    setSmartSwitchMessageId(
        guildId: string,
        serverId: string,
        switchId: string,
        messageId: string | null,
    ): MaybePromise<void>;
    updateSmartSwitchFields(
        guildId: string,
        serverId: string,
        switchId: string,
        patch: SmartSwitchPatch,
    ): MaybePromise<void>;
    setSmartAlarmMessageId(
        guildId: string,
        serverId: string,
        alarmId: string,
        messageId: string | null,
    ): MaybePromise<void>;
    updateSmartAlarmFields(
        guildId: string,
        serverId: string,
        alarmId: string,
        patch: SmartAlarmPatch,
    ): MaybePromise<void>;
    upsertSmartAlarm(guildId: string, serverId: string, alarmId: string, smartAlarm: SmartAlarm): MaybePromise<void>;
    deleteSmartAlarm(guildId: string, serverId: string, alarmId: string): MaybePromise<void>;
    setStorageMonitorMessageId(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        messageId: string | null,
    ): MaybePromise<void>;
    updateStorageMonitorFields(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        patch: StorageMonitorPatch,
    ): MaybePromise<void>;
    upsertStorageMonitor(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        storageMonitor: StorageMonitor,
    ): MaybePromise<void>;
    deleteStorageMonitor(guildId: string, serverId: string, storageMonitorId: string): MaybePromise<void>;
    setSmartSwitchGroupMessageId(
        guildId: string,
        serverId: string,
        groupId: string,
        messageId: string | null,
    ): MaybePromise<void>;
    updateSmartSwitchGroupFields(
        guildId: string,
        serverId: string,
        groupId: string,
        patch: SmartSwitchGroupPatch,
    ): MaybePromise<void>;
    upsertSmartSwitchGroup(
        guildId: string,
        serverId: string,
        groupId: string,
        switchGroup: SwitchGroup,
    ): MaybePromise<void>;
    deleteSmartSwitchGroup(guildId: string, serverId: string, groupId: string): MaybePromise<void>;
    replaceSmartSwitchGroupSwitches(
        guildId: string,
        serverId: string,
        groupId: string,
        switches: SwitchGroup['switches'],
    ): MaybePromise<void>;
    replaceServers(guildId: string, servers: Record<string, Server>): MaybePromise<void>;
    readGuildCollections(guildId: string): MaybePromise<GuildCollectionsState>;
    upsertAlias(guildId: string, alias: Alias): MaybePromise<void>;
    deleteAlias(guildId: string, index: number): MaybePromise<void>;
    setCustomIntlMessage(guildId: string, key: string, message: string | null): MaybePromise<void>;
    addBlacklistEntry(guildId: string, entryType: BlacklistEntryType, entryId: string): MaybePromise<void>;
    removeBlacklistEntry(guildId: string, entryType: BlacklistEntryType, entryId: string): MaybePromise<void>;
    addWhitelistSteamId(guildId: string, steamId: string): MaybePromise<void>;
    removeWhitelistSteamId(guildId: string, steamId: string): MaybePromise<void>;
    addMarketSubscription(guildId: string, listType: MarketSubscriptionType, item: string): MaybePromise<void>;
    removeMarketSubscription(guildId: string, listType: MarketSubscriptionType, item: string): MaybePromise<void>;
    addMarketBlacklistItem(guildId: string, item: string): MaybePromise<void>;
    removeMarketBlacklistItem(guildId: string, item: string): MaybePromise<void>;
    setTeamChatColor(guildId: string, steamId: string, color: string): MaybePromise<void>;
    replaceGuildCollections(guildId: string, collections: GuildCollectionsState): MaybePromise<void>;
    deleteGuild(guildId: string): MaybePromise<void>;
    readCredentials(guildId: string): MaybePromise<Credentials>;
    writeCredentials(guildId: string, credentials: Credentials): MaybePromise<void>;
    bootstrapGuildState(guildId: string, instance: Instance): MaybePromise<void>;
    flush(): Promise<void>;
}

export interface PersistenceConfig {
    adapter: PersistenceAdapterName;
    sqlitePath: string;
    postgresUrl: string | null;
    migrateLegacyJson: boolean;
}

export function instanceToCompatibilityState(instance: Instance): CompatibilityGuildState {
    return {
        firstTime: instance.firstTime,
        role: instance.role,
        adminRole: instance.adminRole,
        activeServer: instance.activeServer,
        channelId: instance.channelId,
        informationMessageId: instance.informationMessageId,
        generalSettings: instance.generalSettings,
        notificationSettings: instance.notificationSettings,
        serverList: instance.serverList,
        trackers: instance.trackers,
        marketSubscriptionList: instance.marketSubscriptionList,
        marketBlacklist: instance.marketBlacklist,
        teamChatColors: instance.teamChatColors,
        blacklist: instance.blacklist,
        whitelist: instance.whitelist,
        aliases: instance.aliases,
        customIntlMessages: instance.customIntlMessages,
    };
}
