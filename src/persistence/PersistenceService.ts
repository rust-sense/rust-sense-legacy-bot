import { addServerLite, createEmptyInstance } from '../domain/guildState.js';
import type { Credentials, GeneralSettings, Instance, NotificationSettings, Server } from '../types/instance.js';
import { instanceToCompatibilityState, type PersistenceAdapter } from './types.js';

type GeneralSettingKey = keyof GeneralSettings;
const guildStateBaseSymbol = Symbol('guildStateBase');
type GuildStateWithBase = Instance & { [guildStateBaseSymbol]?: Instance };

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

        return this.withBaseSnapshot(instance);
    }

    async saveGuildStateChanges(guildId: string, instance: Instance): Promise<void> {
        if (!(await this.adapter.hasGuild(guildId))) {
            await this.adapter.bootstrapGuildState(guildId, instance);
            return;
        }

        const base = (instance as GuildStateWithBase)[guildStateBaseSymbol];
        if (base) {
            await this.adapter.patchGuildState(guildId, base, instance);
            (instance as GuildStateWithBase)[guildStateBaseSymbol] = structuredClone(instance);
            return;
        }

        const current = await this.readGuildState(guildId);
        await this.adapter.patchGuildState(guildId, current, instance);
    }

    private withBaseSnapshot(instance: Instance): Instance {
        Object.defineProperty(instance, guildStateBaseSymbol, {
            configurable: true,
            enumerable: false,
            value: structuredClone(instance),
            writable: true,
        });
        return instance;
    }
}
