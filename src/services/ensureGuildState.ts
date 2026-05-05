import * as Constants from '../domain/constants.js';
import { buildDefaultGeneralSettings, buildDefaultNotificationSettings } from '../domain/guildSettings.js';
import { createEmptyInstance } from '../domain/guildState.js';
import { getPersistenceCache } from '../persistence/index.js';
import type { Instance } from '../types/instance.js';

export default async function ensureGuildState(_client: unknown, guild: { id: string }): Promise<void> {
    let instance: Instance | null = null;
    const persistedInstanceExists = await getPersistenceCache().hasGuild(guild.id);

    if (!persistedInstanceExists) {
        instance = createEmptyInstance();
    } else {
        instance = await getPersistenceCache().readGuildState(guild.id);
        const defaultInstance = createEmptyInstance();

        if (!Object.hasOwn(instance, 'firstTime')) {
            instance.firstTime = true;
        }

        if (!Object.hasOwn(instance, 'role')) {
            instance.role = null;
        }

        if (!Object.hasOwn(instance, 'adminRole')) {
            instance.adminRole = null;
        }

        if (!Object.hasOwn(instance, 'generalSettings')) {
            instance.generalSettings = buildDefaultGeneralSettings();
        } else {
            const generalSettings = buildDefaultGeneralSettings();

            for (const [key, value] of Object.entries(generalSettings)) {
                if (!Object.hasOwn(instance.generalSettings, key)) {
                    instance.generalSettings[key] = value as never;
                }
            }
        }

        if (!Object.hasOwn(instance, 'notificationSettings')) {
            instance.notificationSettings = buildDefaultNotificationSettings();
        } else {
            const notificationSettings = buildDefaultNotificationSettings();

            for (const [key, value] of Object.entries(notificationSettings)) {
                if (!Object.hasOwn(instance.notificationSettings, key)) {
                    instance.notificationSettings[key] = value as Instance['notificationSettings'][string];
                } else {
                    const subSettings = value as Record<string, unknown>;
                    for (const [setting, settingValue] of Object.entries(subSettings)) {
                        if (!Object.hasOwn(instance.notificationSettings[key] ?? {}, setting)) {
                            (instance.notificationSettings[key] ?? {})[setting] = settingValue as never;
                        }
                    }
                }
            }
        }

        if (!Object.hasOwn(instance, 'channelId')) {
            instance.channelId = defaultInstance.channelId;
        } else {
            for (const [key, value] of Object.entries(defaultInstance.channelId)) {
                if (!Object.hasOwn(instance.channelId, key)) {
                    instance.channelId[key as keyof Instance['channelId']] = value;
                }
            }
        }

        if (!Object.hasOwn(instance, 'informationMessageId')) {
            instance.informationMessageId = defaultInstance.informationMessageId;
        } else {
            for (const [key, value] of Object.entries(defaultInstance.informationMessageId)) {
                if (!Object.hasOwn(instance.informationMessageId, key)) {
                    instance.informationMessageId[key as keyof Instance['informationMessageId']] = value;
                }
            }
        }

        if (!Object.hasOwn(instance, 'activeServer')) instance.activeServer = null;
        if (!Object.hasOwn(instance, 'serverList')) instance.serverList = {};
        if (!Object.hasOwn(instance, 'serverListLite')) instance.serverListLite = {};
        if (!Object.hasOwn(instance, 'trackers')) instance.trackers = {};
        if (!Object.hasOwn(instance, 'marketSubscriptionList'))
            instance.marketSubscriptionList = {
                all: [],
                buy: [],
                sell: [],
            };
        if (!Object.hasOwn(instance, 'marketBlacklist')) instance.marketBlacklist = [];
        if (!Object.hasOwn(instance.marketSubscriptionList, 'all')) instance.marketSubscriptionList['all'] = [];
        if (!Object.hasOwn(instance.marketSubscriptionList, 'buy')) instance.marketSubscriptionList['buy'] = [];
        if (!Object.hasOwn(instance.marketSubscriptionList, 'sell')) instance.marketSubscriptionList['sell'] = [];
        if (!Object.hasOwn(instance, 'teamChatColors')) instance.teamChatColors = {};
        if (!Object.hasOwn(instance, 'blacklist'))
            instance.blacklist = {
                discordIds: [],
                steamIds: [],
            };
        if (!Object.hasOwn(instance.blacklist, 'discordIds')) instance.blacklist['discordIds'] = [];
        if (!Object.hasOwn(instance.blacklist, 'steamIds')) instance.blacklist['steamIds'] = [];
        if (!Object.hasOwn(instance, 'whitelist'))
            instance.whitelist = {
                steamIds: [],
            };
        if (!Object.hasOwn(instance.whitelist, 'steamIds')) instance.whitelist['steamIds'] = [];
        if (!Object.hasOwn(instance, 'aliases')) instance.aliases = [];
        if (!Object.hasOwn(instance, 'customIntlMessages')) instance.customIntlMessages = {};

        for (const serverId of Object.keys(instance.serverList)) {
            if (!Object.keys(instance.serverListLite).includes(serverId)) {
                instance.serverListLite[serverId] = {};
            }

            const server = instance.serverList[serverId];
            if (!server) continue;
            const liteEntry = instance.serverListLite[serverId];
            if (!liteEntry) continue;
            liteEntry[server.steamId] = {
                serverIp: server.serverIp,
                appPort: server.appPort,
                steamId: server.steamId,
                playerToken: server.playerToken,
            };
        }
    }

    for (const [_serverId, content] of Object.entries(instance.serverList)) {
        if (!Object.hasOwn(content, 'customCameraGroups')) content.customCameraGroups = {};
        if (!Object.hasOwn(content, 'cargoShipEgressTimeMs')) {
            content.cargoShipEgressTimeMs = Constants.DEFAULT_CARGO_SHIP_EGRESS_TIME_MS;
        }

        if (!Object.hasOwn(content, 'oilRigLockedCrateUnlockTimeMs')) {
            content.oilRigLockedCrateUnlockTimeMs = Constants.DEFAULT_OIL_RIG_LOCKED_CRATE_UNLOCK_TIME_MS;
        }

        if (!Object.hasOwn(content, 'deepSeaMinWipeCooldownMs')) {
            content.deepSeaMinWipeCooldownMs = Constants.DEFAULT_DEEP_SEA_MIN_WIPE_COOLDOWN_MS;
        }

        if (!Object.hasOwn(content, 'deepSeaMaxWipeCooldownMs')) {
            content.deepSeaMaxWipeCooldownMs = Constants.DEFAULT_DEEP_SEA_MAX_WIPE_COOLDOWN_MS;
        }

        if (!Object.hasOwn(content, 'deepSeaWipeDurationMs')) {
            content.deepSeaWipeDurationMs = Constants.DEFAULT_DEEP_SEA_WIPE_DURATION_MS;
        }
    }

    if (!persistedInstanceExists) {
        await getPersistenceCache().bootstrapGuildState(guild.id, instance);
        return;
    }

    await getPersistenceCache().updateGuildCoreFields(guild.id, {
        activeServer: instance.activeServer,
        adminRole: instance.adminRole,
        firstTime: instance.firstTime,
        role: instance.role,
    });
    await getPersistenceCache().setGuildSettingsFromState(guild.id, instance);
    await getPersistenceCache().setDiscordReferencedIds(guild.id, [
        ...Object.entries(instance.channelId).map(([key, value]) => ({ key: `channel.${key}`, value })),
        ...Object.entries(instance.informationMessageId).map(([key, value]) => ({
            key: `informationMessage.${key}`,
            value,
        })),
    ]);
    for (const [serverId, server] of Object.entries(instance.serverList)) {
        await getPersistenceCache().upsertServer(guild.id, serverId, server);
    }
}
