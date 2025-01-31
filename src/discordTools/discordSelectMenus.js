const Discord = require('discord.js');
const fs = require('node:fs');

import { client } from '../index';
const Constants = require('../util/constants');
const Languages = require('../util/languages');

import { cwdPath } from '../utils/filesystemUtils';

module.exports = {
    getSelectMenu: function (options = {}) {
        const selectMenu = new Discord.StringSelectMenuBuilder();

        if (options.hasOwnProperty('customId')) selectMenu.setCustomId(options.customId);
        if (options.hasOwnProperty('placeholder')) selectMenu.setPlaceholder(options.placeholder);
        if (options.hasOwnProperty('options')) {
            for (const option of options.options) {
                option.description = option.description.substring(0, Constants.SELECT_MENU_MAX_DESCRIPTION_CHARACTERS);
            }
            selectMenu.setOptions(options.options);
        }
        if (options.hasOwnProperty('disabled')) selectMenu.setDisabled(options.disabled);

        return selectMenu;
    },

    getLanguageSelectMenu: async (guildId, language) => {
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
            module.exports.getSelectMenu({
                customId: 'language',
                placeholder: `${currentLanguage} (${language})`,
                options: options,
            }),
        );
    },

    getPrefixSelectMenu: function (guildId, prefix) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
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
    },

    getTrademarkOption: function (guildId, trademark) {
        return {
            label: trademark,
            description: client.intlGet(guildId, 'trademarkShownBeforeMessage', {
                trademark: trademark,
            }),
            value: trademark,
        };
    },

    getTrademarkSelectMenu: function (guildId, trademark) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
                customId: 'Trademark',
                placeholder: `${trademark === 'NOT SHOWING' ? client.intlGet(guildId, 'notShowingCap') : trademark}`,
                options: [
                    module.exports.getTrademarkOption(guildId, 'rustplusplus'),
                    module.exports.getTrademarkOption(guildId, 'Rust++'),
                    module.exports.getTrademarkOption(guildId, 'R++'),
                    module.exports.getTrademarkOption(guildId, 'RPP'),
                    module.exports.getTrademarkOption(guildId, 'BOT'),
                    {
                        label: client.intlGet(guildId, 'notShowingCap'),
                        description: client.intlGet(guildId, 'hideTrademark'),
                        value: 'NOT SHOWING',
                    },
                ],
            }),
        );
    },

    getCommandDelaySelectMenu: function (guildId, delay) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
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
    },

    getSmartSwitchSelectMenu: function (guildId, serverId, entityId) {
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
            module.exports.getSelectMenu({
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
    },

    getVoiceGenderSelectMenu: function (guildId, gender) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
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
    },

    getInGameTeammateNameMenu: function (guildId, teammateNameType) {
        const teammateNameTypeReal = client.intlGet(guildId, 'teammateNameTypeReal');
        const teammateNameTypeStreamerMode = client.intlGet(guildId, 'teammateNameTypeStreamerMode');
        const teammateNameTypeCombined = client.intlGet(guildId, 'teammateNameTypeCombined');

        const placeholderMap = {
            realName: teammateNameTypeReal,
            streamerMode: teammateNameTypeStreamerMode,
            combined: teammateNameTypeCombined,
        };

        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
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
                        value: 'streamerMode',
                    },
                    {
                        label: teammateNameTypeCombined,
                        description: client.intlGet(guildId, 'teammateNameTypeCombinedDescription'),
                        value: 'combined',
                    },
                ],
            }),
        );
    },
};
