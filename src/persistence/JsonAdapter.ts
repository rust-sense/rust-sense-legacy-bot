import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createEmptyInstance } from '../domain/guildState.js';
import type { Credentials, Instance } from '../types/instance.js';
import { cwdPath, loadJsonSync } from '../utils/filesystemUtils.js';
import type { GuildCollectionsState, GuildCoreState, GuildSettingsState, PersistenceAdapter } from './types.js';

export class JsonAdapter implements PersistenceAdapter {
    readonly name = 'json' as const;
    readonly deprecated = true;

    async init(): Promise<void> {}

    async close(): Promise<void> {}

    listGuildIds(): string[] {
        const dir = cwdPath('instances');
        if (!fs.existsSync(dir)) return [];

        return fs
            .readdirSync(dir)
            .filter((file) => file.endsWith('.json'))
            .map((file) => path.basename(file, '.json'));
    }

    hasGuild(guildId: string): boolean {
        return fs.existsSync(this.instancePath(guildId));
    }

    sourceManifest(): { guildCount: number; checksum: string } {
        const hash = crypto.createHash('sha256');
        const guildIds = this.listGuildIds().sort();
        for (const guildId of guildIds) {
            hash.update(guildId);
            hash.update('\0');
            if (fs.existsSync(this.instancePath(guildId))) {
                hash.update(fs.readFileSync(this.instancePath(guildId)));
            }
            hash.update('\0');
            if (fs.existsSync(this.credentialsPath(guildId))) {
                hash.update(fs.readFileSync(this.credentialsPath(guildId)));
            }
            hash.update('\0');
        }

        return {
            guildCount: guildIds.length,
            checksum: hash.digest('hex'),
        };
    }

    readGuildCore(guildId: string): GuildCoreState {
        const instance = this.readInstance(guildId);
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
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    readGuildSettings(guildId: string): GuildSettingsState {
        const instance = this.readInstance(guildId);
        return {
            generalSettings: instance.generalSettings,
            notificationSettings: instance.notificationSettings,
        };
    }

    writeGuildSettings(guildId: string, settings: GuildSettingsState): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.generalSettings = settings.generalSettings;
        instance.notificationSettings = settings.notificationSettings;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    readServers(guildId: string): Instance['serverList'] {
        return this.readInstance(guildId).serverList;
    }

    replaceServers(guildId: string, servers: Instance['serverList']): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.serverList = servers;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    readGuildCollections(guildId: string): GuildCollectionsState {
        const instance = this.readInstance(guildId);
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
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteGuild(guildId: string): void {
        for (const filePath of [this.instancePath(guildId), this.credentialsPath(guildId)]) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }

    readCredentials(guildId: string): Credentials {
        if (!fs.existsSync(this.credentialsPath(guildId))) {
            return { hoster: null };
        }

        return loadJsonSync(this.credentialsPath(guildId)) as Credentials;
    }

    writeCredentials(guildId: string, credentials: Credentials): void {
        this.writeJsonAtomic(this.credentialsPath(guildId), credentials);
    }

    bootstrapGuildState(guildId: string, instance: Instance): void {
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    patchGuildState(guildId: string, _base: Instance, next: Instance): void {
        this.writeJsonAtomic(this.instancePath(guildId), next);
    }

    writeGuildDomains(guildId: string, instance: Instance): void {
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    async flush(): Promise<void> {}

    private readInstanceOrEmpty(guildId: string): Instance {
        if (fs.existsSync(this.instancePath(guildId))) return this.readInstance(guildId);

        return createEmptyInstance();
    }

    private instancePath(guildId: string): string {
        return cwdPath('instances', `${guildId}.json`);
    }

    private credentialsPath(guildId: string): string {
        return cwdPath('credentials', `${guildId}.json`);
    }

    private readInstance(guildId: string): Instance {
        return loadJsonSync(this.instancePath(guildId)) as Instance;
    }

    private writeJsonAtomic(filePath: string, data: unknown): void {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
        fs.renameSync(tempPath, filePath);
    }
}
