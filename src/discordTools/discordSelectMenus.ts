import fs from 'node:fs';
import * as Discord from 'discord.js';

import { client } from '../index.js';
import { getTTSProvider } from '../tts/getTTSProvider.js';
import * as Constants from '../util/constants.js';
import { languages as Languages } from '../util/languages.js';

import { cwdPath } from '../utils/filesystemUtils.js';

export function getSelectMenu(options: any = {}) {
    const selectMenu = new Discord.StringSelectMenuBuilder();

    if (Object.hasOwn(options, 'customId')) selectMenu.setCustomId(options.customId);
    if (Object.hasOwn(options, 'placeholder')) selectMenu.setPlaceholder(options.placeholder);
    if (Object.hasOwn(options, 'options')) {
        for (const option of options.options) {
            option.description = option.description.substring(0, Constants.SELECT_MENU_MAX_DESCRIPTION_CHARACTERS);
        }
        selectMenu.setOptions(options.options);
    }
    if (Object.hasOwn(options, 'disabled')) selectMenu.setDisabled(options.disabled);

    return selectMenu;
}

export async function getLanguageSelectMenu(guildId: string, language: string) {
    const languageFiles = await fs.promises.readdir(cwdPath('resources', 'languages'));
    const languageJsonFiles = languageFiles.filter((file) => file.endsWith('.json'));

    const options = [];
    for (const language of languageFiles) {
        const langShort = language.replace('.json', '');
        let langLong = Object.keys(Languages).find((e) => Languages[e] === langShort);
        if (!langLong) langLong = client.intlGet(guildId, 'unknown');
        options.push({
            label: `${langLong} (${langShort})`,
            description: client.intlGet(guildId, 'setBotLanguage', {
                language: `${langLong} (${langShort})`,
            }),
            value: langShort,
        });
    }

    let currentLanguage = Object.keys(Languages).find((e) => Languages[e] === language);
    if (!currentLanguage) currentLanguage = client.intlGet(guildId, 'unknown');

    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: 'language',
            placeholder: `${currentLanguage} (${language})`,
            options: options,
        }),
    );
}

export function getPrefixSelectMenu(guildId: string, prefix: string) {
    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: 'Prefix',
            placeholder: client.intlGet(guildId, 'currentPrefixPlaceholder', { prefix: prefix }),
            options: [
                { label: '!', description: client.intlGet(guildId, 'exclamationMark'), value: '!' },
                { label: '?', description: client.intlGet(guildId, 'questionMark'), value: '?' },
                { label: '.', description: client.intlGet(guildId, 'dot'), value: '.' },
                { label: ':', description: client.intlGet(guildId, 'colon'), value: ':' },
                { label: ',', description: client.intlGet(guildId, 'comma'), value: ',' },
                { label: ';', description: client.intlGet(guildId, 'semicolon'), value: ';' },
                { label: '-', description: client.intlGet(guildId, 'dash'), value: '-' },
                { label: '_', description: client.intlGet(guildId, 'underscore'), value: '_' },
                { label: '=', description: client.intlGet(guildId, 'equalsSign'), value: '=' },
                { label: '*', description: client.intlGet(guildId, 'asterisk'), value: '*' },
                { label: '@', description: client.intlGet(guildId, 'atSign'), value: '@' },
                { label: '+', description: client.intlGet(guildId, 'plusSign'), value: '+' },
                { label: "'", description: client.intlGet(guildId, 'apostrophe'), value: "'" },
                { label: '#', description: client.intlGet(guildId, 'hash'), value: '#' },
                { label: '¤', description: client.intlGet(guildId, 'currencySign'), value: '¤' },
                { label: '%', description: client.intlGet(guildId, 'percentSign'), value: '%' },
                { label: '&', description: client.intlGet(guildId, 'ampersand'), value: '&' },
                { label: '|', description: client.intlGet(guildId, 'pipe'), value: '|' },
                { label: '>', description: client.intlGet(guildId, 'greaterThanSign'), value: '>' },
                { label: '<', description: client.intlGet(guildId, 'lessThanSign'), value: '<' },
                { label: '~', description: client.intlGet(guildId, 'tilde'), value: '~' },
                { label: '^', description: client.intlGet(guildId, 'circumflex'), value: '^' },
                { label: '♥', description: client.intlGet(guildId, 'heart'), value: '♥' },
                { label: '☺', description: client.intlGet(guildId, 'smilyFace'), value: '☺' },
                { label: '/', description: client.intlGet(guildId, 'slash'), value: '/' },
            ],
        }),
    );
}

export function getTrademarkOption(guildId: string, trademark: string) {
    return {
        label: trademark,
        description: client.intlGet(guildId, 'trademarkShownBeforeMessage', {
            trademark: trademark,
        }),
        value: trademark,
    };
}

export function getTrademarkSelectMenu(guildId: string, trademark: string) {
    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: 'Trademark',
            placeholder: `${trademark === 'NOT SHOWING' ? client.intlGet(guildId, 'notShowingCap') : trademark}`,
            options: [
                getTrademarkOption(guildId, 'rustplusplus'),
                getTrademarkOption(guildId, 'Rust++'),
                getTrademarkOption(guildId, 'R++'),
                getTrademarkOption(guildId, 'RPP'),
                getTrademarkOption(guildId, 'BOT'),
                {
                    label: client.intlGet(guildId, 'notShowingCap'),
                    description: client.intlGet(guildId, 'hideTrademark'),
                    value: 'NOT SHOWING',
                },
            ],
        }),
    );
}

export function getCommandDelaySelectMenu(guildId: string, delay: string) {
    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: 'CommandDelay',
            placeholder: client.intlGet(guildId, 'currentCommandDelay', { delay: delay }),
            options: [
                {
                    label: client.intlGet(guildId, 'noDelayCap'),
                    description: client.intlGet(guildId, 'noCommandDelay'),
                    value: '0',
                },
                {
                    label: client.intlGet(guildId, 'second', { second: '1' }),
                    description: client.intlGet(guildId, 'secondCommandDelay', {
                        second: client.intlGet(guildId, 'one'),
                    }),
                    value: '1',
                },
                {
                    label: client.intlGet(guildId, 'seconds', { seconds: '2' }),
                    description: client.intlGet(guildId, 'secondsCommandDelay', {
                        seconds: client.intlGet(guildId, 'two'),
                    }),
                    value: '2',
                },
                {
                    label: client.intlGet(guildId, 'seconds', { seconds: '3' }),
                    description: client.intlGet(guildId, 'secondsCommandDelay', {
                        seconds: client.intlGet(guildId, 'three'),
                    }),
                    value: '3',
                },
                {
                    label: client.intlGet(guildId, 'seconds', { seconds: '4' }),
                    description: client.intlGet(guildId, 'secondsCommandDelay', {
                        seconds: client.intlGet(guildId, 'four'),
                    }),
                    value: '4',
                },
                {
                    label: client.intlGet(guildId, 'seconds', { seconds: '5' }),
                    description: client.intlGet(guildId, 'secondsCommandDelay', {
                        seconds: client.intlGet(guildId, 'five'),
                    }),
                    value: '5',
                },
                {
                    label: client.intlGet(guildId, 'seconds', { seconds: '6' }),
                    description: client.intlGet(guildId, 'secondsCommandDelay', {
                        seconds: client.intlGet(guildId, 'six'),
                    }),
                    value: '6',
                },
                {
                    label: client.intlGet(guildId, 'seconds', { seconds: '7' }),
                    description: client.intlGet(guildId, 'secondsCommandDelay', {
                        seconds: client.intlGet(guildId, 'seven'),
                    }),
                    value: '7',
                },
                {
                    label: client.intlGet(guildId, 'seconds', { seconds: '8' }),
                    description: client.intlGet(guildId, 'secondsCommandDelay', {
                        seconds: client.intlGet(guildId, 'eight'),
                    }),
                    value: '8',
                },
            ],
        }),
    );
}

export function getSmartSwitchSelectMenu(guildId: string, serverId: string, entityId: number) {
    const instance = client.getInstance(guildId);
    const entity = instance.serverList[serverId].switches[entityId];
    const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

    const autoSetting = client.intlGet(guildId, 'autoSettingCap');
    const off = client.intlGet(guildId, 'offCap');
    const autoDay = client.intlGet(guildId, 'autoDayCap');
    const autoNight = client.intlGet(guildId, 'autoNightCap');
    const autoOn = client.intlGet(guildId, 'autoOnCap');
    const autoOff = client.intlGet(guildId, 'autoOffCap');
    const autoOnProximity = client.intlGet(guildId, 'autoOnProximityCap');
    const autoOffProximity = client.intlGet(guildId, 'autoOffProximityCap');
    const autoOnAnyOnline = client.intlGet(guildId, 'autoOnAnyOnlineCap');
    const autoOffAnyOnline = client.intlGet(guildId, 'autoOffAnyOnlineCap');

    let autoDayNightOnOffString = autoSetting;
    if (entity.autoDayNightOnOff === 0) autoDayNightOnOffString += off;
    else if (entity.autoDayNightOnOff === 1) autoDayNightOnOffString += autoDay;
    else if (entity.autoDayNightOnOff === 2) autoDayNightOnOffString += autoNight;
    else if (entity.autoDayNightOnOff === 3) autoDayNightOnOffString += autoOn;
    else if (entity.autoDayNightOnOff === 4) autoDayNightOnOffString += autoOff;
    else if (entity.autoDayNightOnOff === 5) autoDayNightOnOffString += autoOnProximity;
    else if (entity.autoDayNightOnOff === 6) autoDayNightOnOffString += autoOffProximity;
    else if (entity.autoDayNightOnOff === 7) autoDayNightOnOffString += autoOnAnyOnline;
    else if (entity.autoDayNightOnOff === 8) autoDayNightOnOffString += autoOffAnyOnline;

    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: `AutoDayNightOnOff${identifier}`,
            placeholder: `${autoDayNightOnOffString}`,
            options: [
                {
                    label: off,
                    description: client.intlGet(guildId, 'smartSwitchNormal'),
                    value: '0',
                },
                {
                    label: autoDay,
                    description: client.intlGet(guildId, 'smartSwitchAutoDay'),
                    value: '1',
                },
                {
                    label: autoNight,
                    description: client.intlGet(guildId, 'smartSwitchAutoNight'),
                    value: '2',
                },
                {
                    label: autoOn,
                    description: client.intlGet(guildId, 'smartSwitchAutoOn'),
                    value: '3',
                },
                {
                    label: autoOff,
                    description: client.intlGet(guildId, 'smartSwitchAutoOff'),
                    value: '4',
                },
                {
                    label: autoOnProximity,
                    description: client.intlGet(guildId, 'smartSwitchAutoOnProximity'),
                    value: '5',
                },
                {
                    label: autoOffProximity,
                    description: client.intlGet(guildId, 'smartSwitchAutoOffProximity'),
                    value: '6',
                },
                {
                    label: autoOnAnyOnline,
                    description: client.intlGet(guildId, 'smartSwitchAutoOnAnyOnline'),
                    value: '7',
                },
                {
                    label: autoOffAnyOnline,
                    description: client.intlGet(guildId, 'smartSwitchAutoOffAnyOnline'),
                    value: '8',
                },
            ],
        }),
    );
}

export function getVoiceGenderSelectMenu(guildId: string, gender: string) {
    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: 'VoiceGender',
            placeholder: `${
                gender === 'male'
                    ? client.intlGet(guildId, 'commandsVoiceMale')
                    : client.intlGet(guildId, 'commandsVoiceFemale')
            }`,
            options: [
                {
                    label: client.intlGet(guildId, 'commandsVoiceMale'),
                    description: client.intlGet(guildId, 'commandsVoiceMaleDescription'),
                    value: 'male',
                },
                {
                    label: client.intlGet(guildId, 'commandsVoiceFemale'),
                    description: client.intlGet(guildId, 'commandsVoiceFemaleDescription'),
                    value: 'female',
                },
            ],
        }),
    );
}

export function getInGameTeammateNameMenu(guildId: string, teammateNameType: string) {
    const teammateNameTypeReal = client.intlGet(guildId, 'teammateNameTypeReal');
    const teammateNameTypeStreamerMode = client.intlGet(guildId, 'teammateNameTypeStreamerMode');
    const teammateNameTypeCombined = client.intlGet(guildId, 'teammateNameTypeCombined');

    const placeholderMap = {
        realName: teammateNameTypeReal,
        streamerModeName: teammateNameTypeStreamerMode,
        combinedName: teammateNameTypeCombined,
    };

    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: 'TeammateNameType',
            placeholder: placeholderMap[teammateNameType] ?? teammateNameTypeReal,
            options: [
                {
                    label: teammateNameTypeReal,
                    description: client.intlGet(guildId, 'teammateNameTypeRealDescription'),
                    value: 'realName',
                },
                {
                    label: teammateNameTypeStreamerMode,
                    description: client.intlGet(guildId, 'teammateNameTypeStreamerModeDescription'),
                    value: 'streamerModeName',
                },
                {
                    label: teammateNameTypeCombined,
                    description: client.intlGet(guildId, 'teammateNameTypeCombinedDescription'),
                    value: 'combinedName',
                },
            ],
        }),
    );
}

export function getTTSProviderSelectMenu(guildId: string, provider: string) {
    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: 'TTSProvider',
            placeholder: provider === 'piper' ? 'Piper' : 'Oddcast',
            options: [
                {
                    label: 'Oddcast',
                    description: 'Cloud TTS via Oddcast (no setup required)',
                    value: 'oddcast',
                },
                {
                    label: 'Piper',
                    description: 'Local TTS via Piper (models auto-download on first use)',
                    value: 'piper',
                },
            ],
        }),
    );
}

export async function getTTSSettingsComponents(guildId: string) {
    const { ttsProvider } = client.getInstance(guildId).generalSettings;
    return [getTTSProviderSelectMenu(guildId, ttsProvider ?? 'oddcast'), await getTTSVoiceSelectMenu(guildId)];
}

export async function getTTSVoiceSelectMenu(guildId: string) {
    const instance = client.getInstance(guildId);
    const { language, ttsProvider, voiceGender, piperVoice } = instance.generalSettings;
    const provider = getTTSProvider(guildId);
    const voices = await provider.getVoices(language);
    const currentVoice = ttsProvider === 'piper' ? piperVoice : voiceGender;

    if (voices.length === 0) {
        return new Discord.ActionRowBuilder().addComponents(
            getSelectMenu({
                customId: 'TTSVoice',
                placeholder: 'No voices available for this language',
                options: [{ label: 'None', description: 'No voices available', value: 'none' }],
                disabled: true,
            }),
        );
    }

    return new Discord.ActionRowBuilder().addComponents(
        getSelectMenu({
            customId: 'TTSVoice',
            placeholder: voices.find((v) => v.value === currentVoice)?.label ?? voices[0].label,
            options: voices.map((v) => ({ label: v.label, description: v.value, value: v.value })),
        }),
    );
}
