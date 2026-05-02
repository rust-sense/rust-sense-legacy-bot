import fs from 'node:fs';
import type { Credentials, Instance } from '../types/instance.js';
import { loadJsonResourceSync } from '../utils/filesystemUtils.js';
import {
    credentialsPath,
    instancePath,
    legacyGuildIds,
    readLegacyCredentials,
    readLegacyInstance,
    writeJsonAtomic,
} from './legacyJson.js';
import { createEmptyInstance } from './relationalMapping.js';
import type { GuildCollectionsState, GuildCoreState, GuildSettingsState, PersistenceAdapter } from './types.js';

export class JsonAdapter implements PersistenceAdapter {
    readonly name = 'json' as const;
    readonly deprecated = true;

    async init(): Promise<void> {}

    async close(): Promise<void> {}

    listGuildIds(): string[] {
        return legacyGuildIds();
    }

    hasGuild(guildId: string): boolean {
        return fs.existsSync(instancePath(guildId));
    }

    readGuildCore(guildId: string): GuildCoreState {
        const instance = readLegacyInstance(guildId);
        return {
            firstTime: instance.firstTime,
            role: instance.role,
            adminRole: instance.adminRole,
            activeServer: instance.activeServer,
            channelId: instance.channelId,
            informationMessageId: instance.informationMessageId,
        };
    }

    writeGuildCore(guildId: string, core: GuildCoreState): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.firstTime = core.firstTime;
        instance.role = core.role;
        instance.adminRole = core.adminRole;
        instance.activeServer = core.activeServer;
        instance.channelId = core.channelId;
        instance.informationMessageId = core.informationMessageId;
        writeJsonAtomic(instancePath(guildId), instance);
    }

    readGuildSettings(guildId: string): GuildSettingsState {
        const instance = readLegacyInstance(guildId);
        return {
            generalSettings: instance.generalSettings,
            notificationSettings: instance.notificationSettings,
        };
    }

    writeGuildSettings(guildId: string, settings: GuildSettingsState): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.generalSettings = settings.generalSettings;
        instance.notificationSettings = settings.notificationSettings;
        writeJsonAtomic(instancePath(guildId), instance);
    }

    readServers(guildId: string): Instance['serverList'] {
        return readLegacyInstance(guildId).serverList;
    }

    replaceServers(guildId: string, servers: Instance['serverList']): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.serverList = servers;
        writeJsonAtomic(instancePath(guildId), instance);
    }

    readGuildCollections(guildId: string): GuildCollectionsState {
        const instance = readLegacyInstance(guildId);
        return {
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

    replaceGuildCollections(guildId: string, collections: GuildCollectionsState): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.trackers = collections.trackers;
        instance.marketSubscriptionList = collections.marketSubscriptionList;
        instance.marketBlacklist = collections.marketBlacklist;
        instance.teamChatColors = collections.teamChatColors;
        instance.blacklist = collections.blacklist;
        instance.whitelist = collections.whitelist;
        instance.aliases = collections.aliases;
        instance.customIntlMessages = collections.customIntlMessages;
        writeJsonAtomic(instancePath(guildId), instance);
    }

    deleteGuild(guildId: string): void {
        for (const filePath of [instancePath(guildId), credentialsPath(guildId)]) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }

    readCredentials(guildId: string): Credentials {
        return readLegacyCredentials(guildId);
    }

    writeCredentials(guildId: string, credentials: Credentials): void {
        writeJsonAtomic(credentialsPath(guildId), credentials);
    }

    async flush(): Promise<void> {}

    private readInstanceOrEmpty(guildId: string): Instance {
        if (fs.existsSync(instancePath(guildId))) return readLegacyInstance(guildId);

        return createEmptyInstance(
            loadJsonResourceSync<Instance['generalSettings']>('templates/generalSettingsTemplate.json'),
            loadJsonResourceSync<Instance['notificationSettings']>('templates/notificationSettingsTemplate.json'),
        );
    }
}
