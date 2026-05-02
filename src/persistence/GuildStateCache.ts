import type { Credentials, Instance } from '../types/instance.js';
import { addServerLite, createEmptyInstance } from './relationalMapping.js';
import { instanceToCompatibilityState, type PersistenceAdapter } from './types.js';

export class GuildStateCache {
    private instances: Record<string, Instance> = {};
    private credentials: Record<string, Credentials> = {};

    constructor(private readonly adapter: PersistenceAdapter) {}

    listGuildIds(): string[] {
        return this.adapter.listGuildIds();
    }

    hasGuild(guildId: string): boolean {
        return guildId in this.instances || this.adapter.hasGuild(guildId);
    }

    getInstance(guildId: string): Instance {
        if (!(guildId in this.instances)) {
            const settings = this.adapter.readGuildSettings(guildId);
            const core = this.adapter.readGuildCore(guildId);
            const collections = this.adapter.readGuildCollections(guildId);
            const serverList = this.adapter.readServers(guildId);
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

            this.instances[guildId] = instance;
        }

        return this.instances[guildId];
    }

    setInstance(guildId: string, instance: Instance): void {
        this.instances[guildId] = instance;
        const state = instanceToCompatibilityState(instance);
        this.adapter.writeGuildCore(guildId, state);
        this.adapter.writeGuildSettings(guildId, state);
        this.adapter.replaceServers(guildId, state.serverList);
        this.adapter.replaceGuildCollections(guildId, state);
    }

    getCredentials(guildId: string): Credentials {
        if (!(guildId in this.credentials)) {
            this.credentials[guildId] = this.adapter.readCredentials(guildId);
        }

        return this.credentials[guildId];
    }

    setCredentials(guildId: string, credentials: Credentials): void {
        this.credentials[guildId] = credentials;
        this.adapter.writeCredentials(guildId, credentials);
    }

    deleteGuild(guildId: string): void {
        delete this.instances[guildId];
        delete this.credentials[guildId];
        this.adapter.deleteGuild(guildId);
    }

    flush(): Promise<void> {
        return this.adapter.flush();
    }
}
