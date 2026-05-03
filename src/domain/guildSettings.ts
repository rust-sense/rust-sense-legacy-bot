import type { GeneralSettings, Instance, NotificationSettings } from '../types/instance.js';

export const GENERAL_SETTING_DEFAULTS = {
    language: 'en',
    voiceGender: 'male',
    ttsProvider: 'oddcast',
    piperVoice: 'en_US-lessac-medium',
    prefix: '!',
    muteInGameBotMessages: false,
    trademark: 'rust-sense',
    inGameCommandsEnabled: true,
    inGameCommandAccessMode: 'blacklist',
    fcmAlarmNotificationEnabled: false,
    fcmAlarmNotificationEveryone: false,
    smartAlarmNotifyInGame: true,
    smartSwitchNotifyInGameWhenChangedFromDiscord: true,
    leaderCommandEnabled: true,
    leaderCommandOnlyForPaired: false,
    commandDelay: 0,
    connectionNotify: false,
    afkNotify: false,
    deathNotify: false,
    mapWipeNotifyEveryone: false,
    itemAvailableInVendingMachineNotifyInGame: true,
    displayInformationBattlemetricsAllOnlinePlayers: false,
    battlemetricsServerNameChanges: true,
    battlemetricsTrackerNameChanges: true,
    battlemetricsGlobalNameChanges: false,
    battlemetricsGlobalLogin: false,
    battlemetricsGlobalLogout: false,
    teammateNameType: 'realName',
} satisfies Record<string, boolean | number | string>;

export const NOTIFICATION_IMAGES: Record<string, string> = {
    cargoShipDetectedSetting: 'cargoship_logo.png',
    cargoShipLeftSetting: 'cargoship_logo.png',
    cargoShipEgressSetting: 'cargoship_logo.png',
    cargoShipDockingAtHarborSetting: 'cargoship_logo.png',
    patrolHelicopterDetectedSetting: 'patrol_helicopter_logo.png',
    patrolHelicopterLeftSetting: 'patrol_helicopter_logo.png',
    patrolHelicopterDestroyedSetting: 'patrol_helicopter_downed_logo.png',
    lockedCrateOilRigUnlockedSetting: 'locked_crate_logo.png',
    heavyScientistCalledSetting: 'oil_rig_logo.png',
    chinook47DetectedSetting: 'chinook_47_logo.png',
    travelingVendorDetectedSetting: 'traveling_vendor_logo.png',
    travelingVendorHaltedSetting: 'traveling_vendor_logo.png',
    travelingVendorLeftSetting: 'traveling_vendor_logo.png',
    deepSeaDetectedSetting: 'deep_sea_logo.png',
    deepSeaLeftMapSetting: 'deep_sea_logo.png',
    vendingMachineDetectedSetting: 'vending_machine_logo.png',
};

export const NOTIFICATION_DELIVERY_DEFAULTS = {
    discord: true,
    inGame: false,
    voice: true,
} satisfies Record<string, boolean>;

export function buildDefaultGeneralSettings(): GeneralSettings {
    return { ...GENERAL_SETTING_DEFAULTS } as unknown as GeneralSettings;
}

export function buildDefaultNotificationSettings(): NotificationSettings {
    const notificationSettings: NotificationSettings = {};
    for (const [settingKey, image] of Object.entries(NOTIFICATION_IMAGES)) {
        notificationSettings[settingKey] = {
            image,
            ...NOTIFICATION_DELIVERY_DEFAULTS,
        };
    }
    return notificationSettings;
}

export function buildDefaultSettingsState(): Pick<Instance, 'generalSettings' | 'notificationSettings'> {
    return {
        generalSettings: buildDefaultGeneralSettings(),
        notificationSettings: buildDefaultNotificationSettings(),
    };
}
