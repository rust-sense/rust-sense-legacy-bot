import type {
    Alias,
    Blacklist,
    ChannelIds,
    Credentials,
    GeneralSettings,
    InformationMessageIds,
    Instance,
    MarketSubscriptionList,
    NotificationSettings,
    Server,
    Tracker,
    Whitelist,
} from '../types/instance.js';

export type PersistenceAdapterName = 'json' | 'sqlite' | 'postgres';
export type MaybePromise<T> = T | Promise<T>;
export type GuildStateDomain = 'core' | 'settings' | 'servers' | 'collections';

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
    writeGuildCore(guildId: string, core: GuildCoreState): MaybePromise<void>;
    readGuildSettings(guildId: string): MaybePromise<GuildSettingsState>;
    writeGuildSettings(guildId: string, settings: GuildSettingsState): MaybePromise<void>;
    readServers(guildId: string): MaybePromise<Record<string, Server>>;
    replaceServers(guildId: string, servers: Record<string, Server>): MaybePromise<void>;
    readGuildCollections(guildId: string): MaybePromise<GuildCollectionsState>;
    replaceGuildCollections(guildId: string, collections: GuildCollectionsState): MaybePromise<void>;
    deleteGuild(guildId: string): MaybePromise<void>;
    readCredentials(guildId: string): MaybePromise<Credentials>;
    writeCredentials(guildId: string, credentials: Credentials): MaybePromise<void>;
    bootstrapGuildState(guildId: string, instance: Instance): MaybePromise<void>;
    patchGuildState(guildId: string, base: Instance, next: Instance): MaybePromise<void>;
    writeGuildDomains(guildId: string, instance: Instance, domains: GuildStateDomain[]): MaybePromise<void>;
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
