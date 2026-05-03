import {
    GENERAL_SETTING_DEFAULTS,
    NOTIFICATION_DELIVERY_DEFAULTS,
    NOTIFICATION_IMAGES,
} from '../domain/guildSettings.js';
import type { Instance } from '../types/instance.js';

type SettingType = 'boolean' | 'number' | 'string';
type SettingSection = 'general' | 'notification';

interface SettingDefinition {
    key: string;
    section: SettingSection;
    path: string[];
    type: SettingType;
    defaultValue: boolean | number | string;
    persisted: boolean;
}

function settingType(defaultValue: boolean | number | string): SettingType {
    if (typeof defaultValue === 'boolean') return 'boolean';
    if (typeof defaultValue === 'number') return 'number';
    return 'string';
}

const generalDefinitions: SettingDefinition[] = Object.entries(GENERAL_SETTING_DEFAULTS).map(
    ([pathKey, defaultValue]) => ({
        key: `general.${pathKey}`,
        section: 'general',
        path: [pathKey],
        type: settingType(defaultValue),
        defaultValue,
        persisted: true,
    }),
);

const notificationDefinitions: SettingDefinition[] = Object.entries(NOTIFICATION_IMAGES).flatMap(
    ([settingKey, image]) => [
        {
            key: `notification.${settingKey}.image`,
            section: 'notification',
            path: [settingKey, 'image'],
            type: 'string',
            defaultValue: image,
            persisted: false,
        } satisfies SettingDefinition,
        ...Object.entries(NOTIFICATION_DELIVERY_DEFAULTS).map(([deliveryKey, defaultValue]) => ({
            key: `notification.${settingKey}.${deliveryKey}`,
            section: 'notification' as const,
            path: [settingKey, deliveryKey],
            type: 'boolean' as const,
            defaultValue,
            persisted: true,
        })),
    ],
);

export const GUILD_SETTING_DEFINITIONS = [...generalDefinitions, ...notificationDefinitions];
export const PERSISTED_GUILD_SETTING_DEFINITIONS = GUILD_SETTING_DEFINITIONS.filter(
    (definition) => definition.persisted,
);

const definitionsByKey = new Map(GUILD_SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

export function serializeGuildSettingValue(definition: SettingDefinition, value: unknown): string {
    if (definition.type === 'boolean') return value ? 'true' : 'false';
    if (definition.type === 'number') return String(Number(value));
    return String(value);
}

export function deserializeGuildSettingValue(definition: SettingDefinition, value: string): boolean | number | string {
    if (definition.type === 'boolean') return value === 'true' || value === '1';
    if (definition.type === 'number') {
        const numberValue = Number(value);
        return Number.isNaN(numberValue) ? definition.defaultValue : numberValue;
    }
    return value;
}

export function readGuildSettingValue(
    settings: Pick<Instance, 'generalSettings' | 'notificationSettings'>,
    key: string,
) {
    const definition = definitionsByKey.get(key);
    if (!definition) return undefined;
    if (definition.section === 'general') {
        return settings.generalSettings[definition.path[0]] ?? definition.defaultValue;
    }

    return settings.notificationSettings[definition.path[0]]?.[definition.path[1]] ?? definition.defaultValue;
}

export function applyPersistedGuildSetting(
    settings: Pick<Instance, 'generalSettings' | 'notificationSettings'>,
    key: string,
    value: string,
): void {
    const definition = definitionsByKey.get(key);
    if (!definition || !definition.persisted) return;
    const deserialized = deserializeGuildSettingValue(definition, value);
    if (definition.section === 'general') {
        settings.generalSettings[definition.path[0]] = deserialized;
        return;
    }

    settings.notificationSettings[definition.path[0]] ??= {};
    settings.notificationSettings[definition.path[0]][definition.path[1]] = deserialized;
}
