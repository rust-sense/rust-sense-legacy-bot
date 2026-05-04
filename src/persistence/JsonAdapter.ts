import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createEmptyInstance } from '../domain/guildState.js';
import type { Alias, Credentials, Instance, Server, Tracker } from '../types/instance.js';
import { cwdPath, loadJsonSync } from '../utils/filesystemUtils.js';
import { applyPersistedGuildSetting } from './guildSettingsRegistry.js';
import { CHANNEL_ID_KEYS, INFORMATION_MESSAGE_ID_KEYS } from './relational/mapping.js';
import type {
    DiscordReferenceUpdate,
    GuildCollectionsState,
    GuildCorePatch,
    GuildCoreState,
    GuildSettingsState,
    GuildSettingUpdate,
    PersistenceAdapter,
    SmartAlarmPatch,
    SmartSwitchGroupPatch,
    SmartSwitchPatch,
    StorageMonitorPatch,
} from './types.js';

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

    updateGuildCoreFields(guildId: string, patch: GuildCorePatch): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if ('firstTime' in patch) instance.firstTime = patch.firstTime ?? false;
        if ('role' in patch) instance.role = patch.role ?? null;
        if ('adminRole' in patch) instance.adminRole = patch.adminRole ?? null;
        if ('activeServer' in patch) instance.activeServer = patch.activeServer ?? null;
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

    setGuildSettings(guildId: string, updates: GuildSettingUpdate[]): void {
        const instance = this.readInstanceOrEmpty(guildId);
        for (const update of updates) {
            applyPersistedGuildSetting(instance, update.key, update.value);
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setDiscordReferencedIds(guildId: string, updates: DiscordReferenceUpdate[]): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const channelKeys = new Map(CHANNEL_ID_KEYS.map(([property, key]) => [key, property]));
        const informationMessageKeys = new Map(INFORMATION_MESSAGE_ID_KEYS.map(([property, key]) => [key, property]));
        for (const update of updates) {
            const channelProperty = channelKeys.get(update.key);
            if (channelProperty) {
                instance.channelId[channelProperty] = update.value;
                continue;
            }
            const informationMessageProperty = informationMessageKeys.get(update.key);
            if (informationMessageProperty) {
                instance.informationMessageId[informationMessageProperty] = update.value;
            }
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    readServers(guildId: string): Instance['serverList'] {
        return this.readInstance(guildId).serverList;
    }

    readServerLiteEntries(guildId: string): Instance['serverListLite'] {
        return this.readInstance(guildId).serverListLite ?? {};
    }

    replaceServerTimeSamples(
        guildId: string,
        serverId: string,
        timeTillDay: Server['timeTillDay'],
        timeTillNight: Server['timeTillNight'],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) {
            instance.serverList[serverId].timeTillDay = timeTillDay;
            instance.serverList[serverId].timeTillNight = timeTillNight;
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setServerMessageId(guildId: string, serverId: string, messageId: string | null): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) instance.serverList[serverId].messageId = messageId;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    updateServerFields(
        guildId: string,
        serverId: string,
        patch: Parameters<PersistenceAdapter['updateServerFields']>[2],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const server = instance.serverList[serverId];
        if (server) Object.assign(server, patch);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertServer(guildId: string, serverId: string, server: Server): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.serverList[serverId] = server;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteServer(guildId: string, serverId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        delete instance.serverList[serverId];
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertServerLiteEntry(
        guildId: string,
        serverId: string,
        steamId: string,
        entry: Parameters<PersistenceAdapter['upsertServerLiteEntry']>[3],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (!instance.serverListLite[serverId]) instance.serverListLite[serverId] = {};
        instance.serverListLite[serverId][steamId] = entry;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertMarker(
        guildId: string,
        serverId: string,
        markerKey: string,
        marker: Parameters<PersistenceAdapter['upsertMarker']>[3],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) instance.serverList[serverId].markers[markerKey] = marker;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteMarker(guildId: string, serverId: string, markerKey: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) delete instance.serverList[serverId].markers[markerKey];
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertNote(guildId: string, serverId: string, noteId: string | number, note: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) instance.serverList[serverId].notes[Number(noteId)] = note;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteNote(guildId: string, serverId: string, noteId: string | number): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) delete instance.serverList[serverId].notes[Number(noteId)];
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setTrackerMessageId(guildId: string, trackerId: string, messageId: string | null): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.trackers[trackerId]) instance.trackers[trackerId].messageId = messageId;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    updateTrackerFields(
        guildId: string,
        trackerId: string,
        patch: Parameters<PersistenceAdapter['updateTrackerFields']>[2],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const tracker = instance.trackers[trackerId];
        if (tracker) Object.assign(tracker, patch);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertTracker(guildId: string, trackerId: string, tracker: Tracker): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.trackers[trackerId] = tracker;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteTracker(guildId: string, trackerId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        delete instance.trackers[trackerId];
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    replaceTrackerPlayers(guildId: string, trackerId: string, players: Tracker['players']): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.trackers[trackerId]) instance.trackers[trackerId].players = players;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setSmartSwitchMessageId(guildId: string, serverId: string, switchId: string, messageId: string | null): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]?.switches[switchId]) {
            instance.serverList[serverId].switches[switchId].messageId = messageId;
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    updateSmartSwitchFields(guildId: string, serverId: string, switchId: string, patch: SmartSwitchPatch): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const entity = instance.serverList[serverId]?.switches[switchId];
        if (entity) Object.assign(entity, patch);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertSmartSwitch(
        guildId: string,
        serverId: string,
        switchId: string,
        smartSwitch: Parameters<PersistenceAdapter['upsertSmartSwitch']>[3],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) instance.serverList[serverId].switches[Number(switchId)] = smartSwitch;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteSmartSwitch(guildId: string, serverId: string, switchId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) delete instance.serverList[serverId].switches[Number(switchId)];
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setSmartAlarmMessageId(guildId: string, serverId: string, alarmId: string, messageId: string | null): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]?.alarms[alarmId]) {
            instance.serverList[serverId].alarms[alarmId].messageId = messageId;
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    updateSmartAlarmFields(guildId: string, serverId: string, alarmId: string, patch: SmartAlarmPatch): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const entity = instance.serverList[serverId]?.alarms[alarmId];
        if (entity) Object.assign(entity, patch);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertSmartAlarm(
        guildId: string,
        serverId: string,
        alarmId: string,
        smartAlarm: Parameters<PersistenceAdapter['upsertSmartAlarm']>[3],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) instance.serverList[serverId].alarms[Number(alarmId)] = smartAlarm;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteSmartAlarm(guildId: string, serverId: string, alarmId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) delete instance.serverList[serverId].alarms[Number(alarmId)];
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setStorageMonitorMessageId(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        messageId: string | null,
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]?.storageMonitors[storageMonitorId]) {
            instance.serverList[serverId].storageMonitors[storageMonitorId].messageId = messageId;
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    updateStorageMonitorFields(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        patch: StorageMonitorPatch,
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const entity = instance.serverList[serverId]?.storageMonitors[storageMonitorId];
        if (entity) Object.assign(entity, patch);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertStorageMonitor(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        storageMonitor: Parameters<PersistenceAdapter['upsertStorageMonitor']>[3],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) {
            instance.serverList[serverId].storageMonitors[Number(storageMonitorId)] = storageMonitor;
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteStorageMonitor(guildId: string, serverId: string, storageMonitorId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) {
            delete instance.serverList[serverId].storageMonitors[Number(storageMonitorId)];
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setSmartSwitchGroupMessageId(guildId: string, serverId: string, groupId: string, messageId: string | null): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]?.switchGroups[groupId]) {
            instance.serverList[serverId].switchGroups[groupId].messageId = messageId;
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    updateSmartSwitchGroupFields(
        guildId: string,
        serverId: string,
        groupId: string,
        patch: SmartSwitchGroupPatch,
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const entity = instance.serverList[serverId]?.switchGroups[groupId];
        if (entity) Object.assign(entity, patch);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    upsertSmartSwitchGroup(
        guildId: string,
        serverId: string,
        groupId: string,
        switchGroup: Parameters<PersistenceAdapter['upsertSmartSwitchGroup']>[3],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) instance.serverList[serverId].switchGroups[Number(groupId)] = switchGroup;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteSmartSwitchGroup(guildId: string, serverId: string, groupId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (instance.serverList[serverId]) delete instance.serverList[serverId].switchGroups[Number(groupId)];
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    replaceSmartSwitchGroupSwitches(
        guildId: string,
        serverId: string,
        groupId: string,
        switches: Parameters<PersistenceAdapter['replaceSmartSwitchGroupSwitches']>[3],
    ): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const group = instance.serverList[serverId]?.switchGroups[groupId];
        if (group) group.switches = switches;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
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

    upsertAlias(guildId: string, alias: Alias): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.aliases = instance.aliases.filter((entry) => entry.index !== alias.index);
        instance.aliases.push(alias);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    deleteAlias(guildId: string, index: number): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.aliases = instance.aliases.filter((entry) => entry.index !== index);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setCustomIntlMessage(guildId: string, key: string, message: string | null): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (message === null) {
            delete instance.customIntlMessages[key];
        } else {
            instance.customIntlMessages[key] = message;
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    addBlacklistEntry(guildId: string, entryType: 'discord' | 'steam', entryId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        const entries = entryType === 'discord' ? instance.blacklist.discordIds : instance.blacklist.steamIds;
        if (!entries.includes(entryId)) entries.push(entryId);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    removeBlacklistEntry(guildId: string, entryType: 'discord' | 'steam', entryId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (entryType === 'discord') {
            instance.blacklist.discordIds = instance.blacklist.discordIds.filter((entry) => entry !== entryId);
        } else {
            instance.blacklist.steamIds = instance.blacklist.steamIds.filter((entry) => entry !== entryId);
        }
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    addWhitelistSteamId(guildId: string, steamId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (!instance.whitelist.steamIds.includes(steamId)) instance.whitelist.steamIds.push(steamId);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    removeWhitelistSteamId(guildId: string, steamId: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.whitelist.steamIds = instance.whitelist.steamIds.filter((entry) => entry !== steamId);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    addMarketSubscription(guildId: string, listType: 'all' | 'buy' | 'sell', item: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (!instance.marketSubscriptionList[listType].includes(item))
            instance.marketSubscriptionList[listType].push(item);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    removeMarketSubscription(guildId: string, listType: 'all' | 'buy' | 'sell', item: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.marketSubscriptionList[listType] = instance.marketSubscriptionList[listType].filter(
            (entry) => entry !== item,
        );
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    addMarketBlacklistItem(guildId: string, item: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        if (!instance.marketBlacklist.includes(item)) instance.marketBlacklist.push(item);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    removeMarketBlacklistItem(guildId: string, item: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.marketBlacklist = instance.marketBlacklist.filter((entry) => entry !== item);
        this.writeJsonAtomic(this.instancePath(guildId), instance);
    }

    setTeamChatColor(guildId: string, steamId: string, color: string): void {
        const instance = this.readInstanceOrEmpty(guildId);
        instance.teamChatColors[steamId] = color;
        this.writeJsonAtomic(this.instancePath(guildId), instance);
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
