import { addServerLite, createEmptyInstance } from '../domain/guildState.js';
import type { Alias, Credentials, GeneralSettings, Instance, NotificationSettings, Server } from '../types/instance.js';
import {
    PERSISTED_GUILD_SETTING_DEFINITIONS,
    readGuildSettingValue,
    serializeGuildSettingValue,
} from './guildSettingsRegistry.js';
import { type DiscordReferenceUpdate, instanceToCompatibilityState, type PersistenceAdapter } from './types.js';

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

    async markFirstTimeComplete(guildId: string): Promise<void> {
        await this.adapter.updateGuildCoreFields(guildId, { firstTime: false });
    }

    async updateGuildCoreFields(
        guildId: string,
        patch: {
            firstTime?: boolean;
            role?: string | null;
            adminRole?: string | null;
            activeServer?: string | null;
        },
    ): Promise<void> {
        await this.adapter.updateGuildCoreFields(guildId, patch);
    }

    async setGeneralSetting<K extends GeneralSettingKey>(
        guildId: string,
        key: K,
        value: GeneralSettings[K],
    ): Promise<void> {
        await this.adapter.setGuildSettings(guildId, [
            {
                key: `general.${String(key)}`,
                value: String(value),
            },
        ]);
    }

    async setNotificationSettings(guildId: string, notificationSettings: NotificationSettings): Promise<void> {
        const settings = await this.adapter.readGuildSettings(guildId);
        settings.notificationSettings = notificationSettings;
        await this.setGuildSettingsFromState(guildId, settings);
    }

    async setDiscordReferencedIds(guildId: string, updates: DiscordReferenceUpdate[]): Promise<void> {
        await this.adapter.setDiscordReferencedIds(guildId, updates);
    }

    async setGuildSettingsFromState(
        guildId: string,
        settings: Pick<Instance, 'generalSettings' | 'notificationSettings'>,
    ): Promise<void> {
        await this.adapter.setGuildSettings(
            guildId,
            PERSISTED_GUILD_SETTING_DEFINITIONS.map((definition) => ({
                key: definition.key,
                value: serializeGuildSettingValue(definition, readGuildSettingValue(settings, definition.key)),
            })),
        );
    }

    async listServers(guildId: string): Promise<Record<string, Server>> {
        return await this.adapter.readServers(guildId);
    }

    async getServer(guildId: string, serverId: string): Promise<Server | null> {
        return (await this.adapter.readServers(guildId))[serverId] ?? null;
    }

    async setServerMessageId(guildId: string, serverId: string, messageId: string | null): Promise<void> {
        await this.adapter.setServerMessageId(guildId, serverId, messageId);
    }

    async updateServerFields(
        guildId: string,
        serverId: string,
        patch: Parameters<PersistenceAdapter['updateServerFields']>[2],
    ): Promise<void> {
        await this.adapter.updateServerFields(guildId, serverId, patch);
    }

    async replaceServerTimeSamples(
        guildId: string,
        serverId: string,
        timeTillDay: Server['timeTillDay'],
        timeTillNight: Server['timeTillNight'],
    ): Promise<void> {
        await this.adapter.replaceServerTimeSamples(guildId, serverId, timeTillDay, timeTillNight);
    }

    async setTrackerMessageId(guildId: string, trackerId: string, messageId: string | null): Promise<void> {
        await this.adapter.setTrackerMessageId(guildId, trackerId, messageId);
    }

    async replaceTrackerPlayers(
        guildId: string,
        trackerId: string,
        players: Parameters<PersistenceAdapter['replaceTrackerPlayers']>[2],
    ): Promise<void> {
        await this.adapter.replaceTrackerPlayers(guildId, trackerId, players);
    }

    async updateTrackerFields(
        guildId: string,
        trackerId: string,
        patch: Parameters<PersistenceAdapter['updateTrackerFields']>[2],
    ): Promise<void> {
        await this.adapter.updateTrackerFields(guildId, trackerId, patch);
    }

    async upsertTracker(
        guildId: string,
        trackerId: string,
        tracker: Parameters<PersistenceAdapter['upsertTracker']>[2],
    ): Promise<void> {
        await this.adapter.upsertTracker(guildId, trackerId, tracker);
    }

    async deleteTracker(guildId: string, trackerId: string): Promise<void> {
        await this.adapter.deleteTracker(guildId, trackerId);
    }

    async upsertSmartSwitch(
        guildId: string,
        serverId: string,
        switchId: string,
        smartSwitch: Parameters<PersistenceAdapter['upsertSmartSwitch']>[3],
    ): Promise<void> {
        await this.adapter.upsertSmartSwitch(guildId, serverId, switchId, smartSwitch);
    }

    async deleteSmartSwitch(guildId: string, serverId: string, switchId: string): Promise<void> {
        await this.adapter.deleteSmartSwitch(guildId, serverId, switchId);
    }

    async setSmartSwitchMessageId(
        guildId: string,
        serverId: string,
        switchId: string,
        messageId: string | null,
    ): Promise<void> {
        await this.adapter.setSmartSwitchMessageId(guildId, serverId, switchId, messageId);
    }

    async updateSmartSwitchFields(
        guildId: string,
        serverId: string,
        switchId: string,
        patch: Parameters<PersistenceAdapter['updateSmartSwitchFields']>[3],
    ): Promise<void> {
        await this.adapter.updateSmartSwitchFields(guildId, serverId, switchId, patch);
    }

    async setSmartAlarmMessageId(
        guildId: string,
        serverId: string,
        alarmId: string,
        messageId: string | null,
    ): Promise<void> {
        await this.adapter.setSmartAlarmMessageId(guildId, serverId, alarmId, messageId);
    }

    async updateSmartAlarmFields(
        guildId: string,
        serverId: string,
        alarmId: string,
        patch: Parameters<PersistenceAdapter['updateSmartAlarmFields']>[3],
    ): Promise<void> {
        await this.adapter.updateSmartAlarmFields(guildId, serverId, alarmId, patch);
    }

    async upsertSmartAlarm(
        guildId: string,
        serverId: string,
        alarmId: string,
        smartAlarm: Parameters<PersistenceAdapter['upsertSmartAlarm']>[3],
    ): Promise<void> {
        await this.adapter.upsertSmartAlarm(guildId, serverId, alarmId, smartAlarm);
    }

    async deleteSmartAlarm(guildId: string, serverId: string, alarmId: string): Promise<void> {
        await this.adapter.deleteSmartAlarm(guildId, serverId, alarmId);
    }

    async setStorageMonitorMessageId(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        messageId: string | null,
    ): Promise<void> {
        await this.adapter.setStorageMonitorMessageId(guildId, serverId, storageMonitorId, messageId);
    }

    async updateStorageMonitorFields(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        patch: Parameters<PersistenceAdapter['updateStorageMonitorFields']>[3],
    ): Promise<void> {
        await this.adapter.updateStorageMonitorFields(guildId, serverId, storageMonitorId, patch);
    }

    async upsertStorageMonitor(
        guildId: string,
        serverId: string,
        storageMonitorId: string,
        storageMonitor: Parameters<PersistenceAdapter['upsertStorageMonitor']>[3],
    ): Promise<void> {
        await this.adapter.upsertStorageMonitor(guildId, serverId, storageMonitorId, storageMonitor);
    }

    async deleteStorageMonitor(guildId: string, serverId: string, storageMonitorId: string): Promise<void> {
        await this.adapter.deleteStorageMonitor(guildId, serverId, storageMonitorId);
    }

    async setSmartSwitchGroupMessageId(
        guildId: string,
        serverId: string,
        groupId: string,
        messageId: string | null,
    ): Promise<void> {
        await this.adapter.setSmartSwitchGroupMessageId(guildId, serverId, groupId, messageId);
    }

    async updateSmartSwitchGroupFields(
        guildId: string,
        serverId: string,
        groupId: string,
        patch: Parameters<PersistenceAdapter['updateSmartSwitchGroupFields']>[3],
    ): Promise<void> {
        await this.adapter.updateSmartSwitchGroupFields(guildId, serverId, groupId, patch);
    }

    async upsertSmartSwitchGroup(
        guildId: string,
        serverId: string,
        groupId: string,
        switchGroup: Parameters<PersistenceAdapter['upsertSmartSwitchGroup']>[3],
    ): Promise<void> {
        await this.adapter.upsertSmartSwitchGroup(guildId, serverId, groupId, switchGroup);
    }

    async deleteSmartSwitchGroup(guildId: string, serverId: string, groupId: string): Promise<void> {
        await this.adapter.deleteSmartSwitchGroup(guildId, serverId, groupId);
    }

    async replaceSmartSwitchGroupSwitches(
        guildId: string,
        serverId: string,
        groupId: string,
        switches: Parameters<PersistenceAdapter['replaceSmartSwitchGroupSwitches']>[3],
    ): Promise<void> {
        await this.adapter.replaceSmartSwitchGroupSwitches(guildId, serverId, groupId, switches);
    }

    async upsertServer(guildId: string, serverId: string, server: Server): Promise<void> {
        await this.adapter.upsertServer(guildId, serverId, server);
    }

    async deleteServer(guildId: string, serverId: string): Promise<void> {
        await this.adapter.deleteServer(guildId, serverId);
    }

    async upsertServerLiteEntry(
        guildId: string,
        serverId: string,
        steamId: string,
        entry: Parameters<PersistenceAdapter['upsertServerLiteEntry']>[3],
    ): Promise<void> {
        await this.adapter.upsertServerLiteEntry(guildId, serverId, steamId, entry);
    }

    async upsertMarker(
        guildId: string,
        serverId: string,
        markerKey: string,
        marker: Parameters<PersistenceAdapter['upsertMarker']>[3],
    ): Promise<void> {
        await this.adapter.upsertMarker(guildId, serverId, markerKey, marker);
    }

    async deleteMarker(guildId: string, serverId: string, markerKey: string): Promise<void> {
        await this.adapter.deleteMarker(guildId, serverId, markerKey);
    }

    async upsertNote(guildId: string, serverId: string, noteId: string | number, note: string): Promise<void> {
        await this.adapter.upsertNote(guildId, serverId, noteId, note);
    }

    async deleteNote(guildId: string, serverId: string, noteId: string | number): Promise<void> {
        await this.adapter.deleteNote(guildId, serverId, noteId);
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

    async bootstrapGuildState(guildId: string, instance: Instance): Promise<void> {
        await this.adapter.bootstrapGuildState(guildId, instance);
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

    async upsertAlias(guildId: string, alias: Alias): Promise<void> {
        await this.adapter.upsertAlias(guildId, alias);
    }

    async deleteAlias(guildId: string, index: number): Promise<void> {
        await this.adapter.deleteAlias(guildId, index);
    }

    async setCustomIntlMessage(guildId: string, key: string, message: string | null): Promise<void> {
        await this.adapter.setCustomIntlMessage(guildId, key, message);
    }

    async addBlacklistEntry(
        guildId: string,
        entryType: Parameters<PersistenceAdapter['addBlacklistEntry']>[1],
        entryId: string,
    ): Promise<void> {
        await this.adapter.addBlacklistEntry(guildId, entryType, entryId);
    }

    async removeBlacklistEntry(
        guildId: string,
        entryType: Parameters<PersistenceAdapter['removeBlacklistEntry']>[1],
        entryId: string,
    ): Promise<void> {
        await this.adapter.removeBlacklistEntry(guildId, entryType, entryId);
    }

    async addWhitelistSteamId(guildId: string, steamId: string): Promise<void> {
        await this.adapter.addWhitelistSteamId(guildId, steamId);
    }

    async removeWhitelistSteamId(guildId: string, steamId: string): Promise<void> {
        await this.adapter.removeWhitelistSteamId(guildId, steamId);
    }

    async addMarketSubscription(
        guildId: string,
        listType: Parameters<PersistenceAdapter['addMarketSubscription']>[1],
        item: string,
    ): Promise<void> {
        await this.adapter.addMarketSubscription(guildId, listType, item);
    }

    async removeMarketSubscription(
        guildId: string,
        listType: Parameters<PersistenceAdapter['removeMarketSubscription']>[1],
        item: string,
    ): Promise<void> {
        await this.adapter.removeMarketSubscription(guildId, listType, item);
    }

    async addMarketBlacklistItem(guildId: string, item: string): Promise<void> {
        await this.adapter.addMarketBlacklistItem(guildId, item);
    }

    async removeMarketBlacklistItem(guildId: string, item: string): Promise<void> {
        await this.adapter.removeMarketBlacklistItem(guildId, item);
    }

    async setTeamChatColor(guildId: string, steamId: string, color: string): Promise<void> {
        await this.adapter.setTeamChatColor(guildId, steamId, color);
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
        instance.serverListLite = await this.adapter.readServerLiteEntries(guildId);
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
}
