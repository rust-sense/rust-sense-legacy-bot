import type { Credentials, GeneralSettings, Instance, NotificationSettings, Server } from '../types/instance.js';
import { addServerLite, createEmptyInstance } from './relationalMapping.js';
import { type GuildStateDomain, instanceToCompatibilityState, type PersistenceAdapter } from './types.js';

type GeneralSettingKey = keyof GeneralSettings;

export class PersistenceService {
    constructor(private readonly adapter: PersistenceAdapter) {}

    async listGuildIds(): Promise<string[]> {
        return await this.adapter.listGuildIds();
    }

    async hasGuild(guildId: string): Promise<boolean> {
        return await this.adapter.hasGuild(guildId);
    }

    async getSettingsView(guildId: string): Promise<{
        generalSettings: GeneralSettings;
        notificationSettings: NotificationSettings;
    }> {
        return await this.adapter.readGuildSettings(guildId);
    }

    async setGeneralSetting<K extends GeneralSettingKey>(
        guildId: string,
        key: K,
        value: GeneralSettings[K],
    ): Promise<void> {
        const settings = await this.adapter.readGuildSettings(guildId);
        settings.generalSettings[key] = value;
        await this.adapter.writeGuildSettings(guildId, settings);
    }

    async setNotificationSettings(guildId: string, notificationSettings: NotificationSettings): Promise<void> {
        const settings = await this.adapter.readGuildSettings(guildId);
        settings.notificationSettings = notificationSettings;
        await this.adapter.writeGuildSettings(guildId, settings);
    }

    async listServers(guildId: string): Promise<Record<string, Server>> {
        return await this.adapter.readServers(guildId);
    }

    async getServer(guildId: string, serverId: string): Promise<Server | null> {
        return (await this.adapter.readServers(guildId))[serverId] ?? null;
    }

    async upsertServer(guildId: string, serverId: string, server: Server): Promise<void> {
        const servers = await this.adapter.readServers(guildId);
        servers[serverId] = server;
        await this.adapter.replaceServers(guildId, servers);
    }

    async deleteServer(guildId: string, serverId: string): Promise<void> {
        const servers = await this.adapter.readServers(guildId);
        delete servers[serverId];
        await this.adapter.replaceServers(guildId, servers);
    }

    async getCredentials(guildId: string): Promise<Credentials> {
        return await this.adapter.readCredentials(guildId);
    }

    async setCredentials(guildId: string, credentials: Credentials): Promise<void> {
        await this.adapter.writeCredentials(guildId, credentials);
    }

    async setHoster(guildId: string, steamId: string | null): Promise<void> {
        const credentials = await this.adapter.readCredentials(guildId);
        credentials.hoster = steamId;
        await this.adapter.writeCredentials(guildId, credentials);
    }

    async upsertCredential(guildId: string, steamId: string, credential: unknown): Promise<void> {
        const credentials = await this.adapter.readCredentials(guildId);
        (credentials as unknown as Record<string, unknown>)[steamId] = credential;
        await this.adapter.writeCredentials(guildId, credentials);
    }

    async removeCredential(guildId: string, steamId: string): Promise<void> {
        const credentials = await this.adapter.readCredentials(guildId);
        if (credentials.hoster === steamId) credentials.hoster = null;
        delete credentials[steamId];
        await this.adapter.writeCredentials(guildId, credentials);
    }

    async deleteGuild(guildId: string): Promise<void> {
        await this.adapter.deleteGuild(guildId);
    }

    async updateGuildCore(guildId: string, update: (instance: Instance) => void | Promise<void>): Promise<Instance> {
        const instance = await this.readGuildState(guildId);
        await update(instance);
        await this.adapter.writeGuildCore(guildId, instanceToCompatibilityState(instance));
        return instance;
    }

    async updateGuildSettings(
        guildId: string,
        update: (instance: Instance) => void | Promise<void>,
    ): Promise<Instance> {
        const instance = await this.readGuildState(guildId);
        await update(instance);
        await this.adapter.writeGuildSettings(guildId, instanceToCompatibilityState(instance));
        return instance;
    }

    async updateServers(guildId: string, update: (instance: Instance) => void | Promise<void>): Promise<Instance> {
        const instance = await this.readGuildState(guildId);
        await update(instance);
        await this.adapter.replaceServers(guildId, instance.serverList);
        return instance;
    }

    async updateGuildCollections(
        guildId: string,
        update: (instance: Instance) => void | Promise<void>,
    ): Promise<Instance> {
        const instance = await this.readGuildState(guildId);
        await update(instance);
        await this.adapter.replaceGuildCollections(guildId, instanceToCompatibilityState(instance));
        return instance;
    }

    flush(): Promise<void> {
        return this.adapter.flush();
    }

    async readGuildState(guildId: string): Promise<Instance> {
        const settings = await this.adapter.readGuildSettings(guildId);
        const core = await this.adapter.readGuildCore(guildId);
        const collections = await this.adapter.readGuildCollections(guildId);
        const serverList = await this.adapter.readServers(guildId);
        const instance = createEmptyInstance(settings.generalSettings, settings.notificationSettings);

        instance.firstTime = core.firstTime;
        instance.role = core.role;
        instance.adminRole = core.adminRole;
        instance.activeServer = core.activeServer;
        instance.channelId = core.channelId;
        instance.informationMessageId = core.informationMessageId;
        instance.serverList = serverList;
        instance.serverListLite = {};
        for (const server of Object.values(serverList)) {
            addServerLite(instance, server);
        }
        instance.trackers = collections.trackers;
        instance.marketSubscriptionList = collections.marketSubscriptionList;
        instance.marketBlacklist = collections.marketBlacklist;
        instance.teamChatColors = collections.teamChatColors;
        instance.blacklist = collections.blacklist;
        instance.whitelist = collections.whitelist;
        instance.aliases = collections.aliases;
        instance.customIntlMessages = collections.customIntlMessages;

        return instance;
    }

    async saveGuildStateChanges(guildId: string, instance: Instance): Promise<void> {
        if (!(await this.adapter.hasGuild(guildId))) {
            await this.adapter.bootstrapGuildState(guildId, instance);
            return;
        }

        const current = await this.readGuildState(guildId);
        const state = instanceToCompatibilityState(instance);
        const domains: GuildStateDomain[] = [];

        if (
            current.firstTime !== instance.firstTime ||
            current.role !== instance.role ||
            current.adminRole !== instance.adminRole ||
            current.activeServer !== instance.activeServer ||
            JSON.stringify(current.channelId) !== JSON.stringify(instance.channelId) ||
            JSON.stringify(current.informationMessageId) !== JSON.stringify(instance.informationMessageId)
        ) {
            domains.push('core');
        }

        if (
            JSON.stringify(current.generalSettings) !== JSON.stringify(instance.generalSettings) ||
            JSON.stringify(current.notificationSettings) !== JSON.stringify(instance.notificationSettings)
        ) {
            domains.push('settings');
        }

        if (JSON.stringify(current.serverList) !== JSON.stringify(instance.serverList)) {
            domains.push('servers');
        }

        if (
            JSON.stringify(current.trackers) !== JSON.stringify(instance.trackers) ||
            JSON.stringify(current.marketSubscriptionList) !== JSON.stringify(instance.marketSubscriptionList) ||
            JSON.stringify(current.marketBlacklist) !== JSON.stringify(instance.marketBlacklist) ||
            JSON.stringify(current.teamChatColors) !== JSON.stringify(instance.teamChatColors) ||
            JSON.stringify(current.blacklist) !== JSON.stringify(instance.blacklist) ||
            JSON.stringify(current.whitelist) !== JSON.stringify(instance.whitelist) ||
            JSON.stringify(current.aliases) !== JSON.stringify(instance.aliases) ||
            JSON.stringify(current.customIntlMessages) !== JSON.stringify(instance.customIntlMessages)
        ) {
            domains.push('collections');
        }

        if (domains.length > 0) {
            await this.adapter.writeGuildDomains(guildId, instance, domains);
        }
    }
}
