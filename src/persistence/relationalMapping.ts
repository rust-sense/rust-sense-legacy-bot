import type { Credentials, Instance, NotificationSettings, Server, Tracker } from '../types/instance.js';

export const NOTIFICATION_COLUMNS: Array<[string, string, string]> = [
    ['cargoShipDetectedSetting', 'cargo_ship_detected', 'image'],
    ['cargoShipDetectedSetting', 'cargo_ship_detected', 'discord'],
    ['cargoShipDetectedSetting', 'cargo_ship_detected', 'inGame'],
    ['cargoShipDetectedSetting', 'cargo_ship_detected', 'voice'],
    ['cargoShipLeftSetting', 'cargo_ship_left', 'image'],
    ['cargoShipLeftSetting', 'cargo_ship_left', 'discord'],
    ['cargoShipLeftSetting', 'cargo_ship_left', 'inGame'],
    ['cargoShipLeftSetting', 'cargo_ship_left', 'voice'],
    ['cargoShipEgressSetting', 'cargo_ship_egress', 'image'],
    ['cargoShipEgressSetting', 'cargo_ship_egress', 'discord'],
    ['cargoShipEgressSetting', 'cargo_ship_egress', 'inGame'],
    ['cargoShipEgressSetting', 'cargo_ship_egress', 'voice'],
    ['cargoShipDockingAtHarborSetting', 'cargo_ship_docking_at_harbor', 'image'],
    ['cargoShipDockingAtHarborSetting', 'cargo_ship_docking_at_harbor', 'discord'],
    ['cargoShipDockingAtHarborSetting', 'cargo_ship_docking_at_harbor', 'inGame'],
    ['cargoShipDockingAtHarborSetting', 'cargo_ship_docking_at_harbor', 'voice'],
    ['patrolHelicopterDetectedSetting', 'patrol_helicopter_detected', 'image'],
    ['patrolHelicopterDetectedSetting', 'patrol_helicopter_detected', 'discord'],
    ['patrolHelicopterDetectedSetting', 'patrol_helicopter_detected', 'inGame'],
    ['patrolHelicopterDetectedSetting', 'patrol_helicopter_detected', 'voice'],
    ['patrolHelicopterLeftSetting', 'patrol_helicopter_left', 'image'],
    ['patrolHelicopterLeftSetting', 'patrol_helicopter_left', 'discord'],
    ['patrolHelicopterLeftSetting', 'patrol_helicopter_left', 'inGame'],
    ['patrolHelicopterLeftSetting', 'patrol_helicopter_left', 'voice'],
    ['patrolHelicopterDestroyedSetting', 'patrol_helicopter_destroyed', 'image'],
    ['patrolHelicopterDestroyedSetting', 'patrol_helicopter_destroyed', 'discord'],
    ['patrolHelicopterDestroyedSetting', 'patrol_helicopter_destroyed', 'inGame'],
    ['patrolHelicopterDestroyedSetting', 'patrol_helicopter_destroyed', 'voice'],
    ['lockedCrateOilRigUnlockedSetting', 'locked_crate_oil_rig_unlocked', 'image'],
    ['lockedCrateOilRigUnlockedSetting', 'locked_crate_oil_rig_unlocked', 'discord'],
    ['lockedCrateOilRigUnlockedSetting', 'locked_crate_oil_rig_unlocked', 'inGame'],
    ['lockedCrateOilRigUnlockedSetting', 'locked_crate_oil_rig_unlocked', 'voice'],
    ['heavyScientistCalledSetting', 'heavy_scientist_called', 'image'],
    ['heavyScientistCalledSetting', 'heavy_scientist_called', 'discord'],
    ['heavyScientistCalledSetting', 'heavy_scientist_called', 'inGame'],
    ['heavyScientistCalledSetting', 'heavy_scientist_called', 'voice'],
    ['chinook47DetectedSetting', 'chinook47_detected', 'image'],
    ['chinook47DetectedSetting', 'chinook47_detected', 'discord'],
    ['chinook47DetectedSetting', 'chinook47_detected', 'inGame'],
    ['chinook47DetectedSetting', 'chinook47_detected', 'voice'],
    ['travelingVendorDetectedSetting', 'traveling_vendor_detected', 'image'],
    ['travelingVendorDetectedSetting', 'traveling_vendor_detected', 'discord'],
    ['travelingVendorDetectedSetting', 'traveling_vendor_detected', 'inGame'],
    ['travelingVendorDetectedSetting', 'traveling_vendor_detected', 'voice'],
    ['travelingVendorHaltedSetting', 'traveling_vendor_halted', 'image'],
    ['travelingVendorHaltedSetting', 'traveling_vendor_halted', 'discord'],
    ['travelingVendorHaltedSetting', 'traveling_vendor_halted', 'inGame'],
    ['travelingVendorHaltedSetting', 'traveling_vendor_halted', 'voice'],
    ['travelingVendorLeftSetting', 'traveling_vendor_left', 'image'],
    ['travelingVendorLeftSetting', 'traveling_vendor_left', 'discord'],
    ['travelingVendorLeftSetting', 'traveling_vendor_left', 'inGame'],
    ['travelingVendorLeftSetting', 'traveling_vendor_left', 'voice'],
    ['deepSeaDetectedSetting', 'deep_sea_detected', 'image'],
    ['deepSeaDetectedSetting', 'deep_sea_detected', 'discord'],
    ['deepSeaDetectedSetting', 'deep_sea_detected', 'inGame'],
    ['deepSeaDetectedSetting', 'deep_sea_detected', 'voice'],
    ['deepSeaLeftMapSetting', 'deep_sea_left_map', 'image'],
    ['deepSeaLeftMapSetting', 'deep_sea_left_map', 'discord'],
    ['deepSeaLeftMapSetting', 'deep_sea_left_map', 'inGame'],
    ['deepSeaLeftMapSetting', 'deep_sea_left_map', 'voice'],
    ['vendingMachineDetectedSetting', 'vending_machine_detected', 'image'],
    ['vendingMachineDetectedSetting', 'vending_machine_detected', 'discord'],
    ['vendingMachineDetectedSetting', 'vending_machine_detected', 'inGame'],
    ['vendingMachineDetectedSetting', 'vending_machine_detected', 'voice'],
];

export const GENERAL_COLUMNS: Array<[keyof Instance['generalSettings'], string]> = [
    ['language', 'language'],
    ['voiceGender', 'voice_gender'],
    ['ttsProvider', 'tts_provider'],
    ['piperVoice', 'piper_voice'],
    ['prefix', 'prefix'],
    ['muteInGameBotMessages', 'mute_in_game_bot_messages'],
    ['trademark', 'trademark'],
    ['inGameCommandsEnabled', 'in_game_commands_enabled'],
    ['inGameCommandAccessMode', 'in_game_command_access_mode'],
    ['fcmAlarmNotificationEnabled', 'fcm_alarm_notification_enabled'],
    ['fcmAlarmNotificationEveryone', 'fcm_alarm_notification_everyone'],
    ['smartAlarmNotifyInGame', 'smart_alarm_notify_in_game'],
    ['smartSwitchNotifyInGameWhenChangedFromDiscord', 'smart_switch_notify_in_game_when_changed_from_discord'],
    ['leaderCommandEnabled', 'leader_command_enabled'],
    ['leaderCommandOnlyForPaired', 'leader_command_only_for_paired'],
    ['commandDelay', 'command_delay'],
    ['connectionNotify', 'connection_notify'],
    ['afkNotify', 'afk_notify'],
    ['deathNotify', 'death_notify'],
    ['mapWipeNotifyEveryone', 'map_wipe_notify_everyone'],
    ['itemAvailableInVendingMachineNotifyInGame', 'item_available_in_vending_machine_notify_in_game'],
    ['displayInformationBattlemetricsAllOnlinePlayers', 'display_information_battlemetrics_all_online_players'],
    ['battlemetricsServerNameChanges', 'battlemetrics_server_name_changes'],
    ['battlemetricsTrackerNameChanges', 'battlemetrics_tracker_name_changes'],
    ['battlemetricsGlobalNameChanges', 'battlemetrics_global_name_changes'],
    ['battlemetricsGlobalLogin', 'battlemetrics_global_login'],
    ['battlemetricsGlobalLogout', 'battlemetrics_global_logout'],
    ['teammateNameType', 'teammate_name_type'],
];

export function dbBool(value: unknown): number {
    return value ? 1 : 0;
}

export function fromDbBool(value: unknown): boolean {
    return value === 1 || value === true;
}

export function createEmptyInstance(
    generalSettings: Instance['generalSettings'],
    notificationSettings: NotificationSettings,
): Instance {
    return {
        firstTime: true,
        role: null,
        adminRole: null,
        generalSettings,
        notificationSettings,
        channelId: {
            category: null,
            information: null,
            servers: null,
            settings: null,
            commands: null,
            events: null,
            teamchat: null,
            switches: null,
            switchGroups: null,
            alarms: null,
            storageMonitors: null,
            activity: null,
            trackers: null,
        },
        informationMessageId: {
            map: null,
            server: null,
            event: null,
            team: null,
            battlemetricsPlayers: null,
        },
        activeServer: null,
        serverList: {},
        serverListLite: {},
        trackers: {},
        marketSubscriptionList: {
            all: [],
            buy: [],
            sell: [],
        },
        marketBlacklist: [],
        teamChatColors: {},
        blacklist: {
            discordIds: [],
            steamIds: [],
        },
        whitelist: {
            steamIds: [],
        },
        aliases: [],
        customIntlMessages: {},
    };
}

export function credentialEntries(credentials: Credentials): Array<[string, Record<string, unknown>]> {
    return Object.entries(credentials).filter(
        ([steamId, value]) => steamId !== 'hoster' && typeof value === 'object' && value,
    );
}

export function addServerLite(instance: Instance, server: Server): void {
    if (!(server.serverId in instance.serverListLite)) {
        instance.serverListLite[server.serverId] = {};
    }

    instance.serverListLite[server.serverId][server.steamId] = {
        serverIp: server.serverIp,
        appPort: server.appPort,
        steamId: server.steamId,
        playerToken: server.playerToken,
    };
}

export function normalizeTracker(trackerKey: string, tracker: Tracker): Tracker {
    return {
        id: tracker.id ?? Number(trackerKey),
        name: tracker.name,
        battlemetricsId: tracker.battlemetricsId,
        status: tracker.status,
        lastScreenshot: tracker.lastScreenshot ?? null,
        lastOnline: tracker.lastOnline ?? null,
        lastWipe: tracker.lastWipe ?? null,
        messageId: tracker.messageId ?? null,
        clanTag: tracker.clanTag ?? null,
        everyone: tracker.everyone,
        inGame: tracker.inGame,
        img: tracker.img,
        title: tracker.title,
        serverId: tracker.serverId,
        players: tracker.players ?? [],
    };
}
