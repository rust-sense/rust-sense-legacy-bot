const Discord = require('discord.js');
const fs = require('node:fs');

const Client = require('../index');
const Constants = require('../util/constants');
const Languages = require('../util/languages');

import { cwdPath } from '../service/resourceManager';

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
            if (!langLong) langLong = Client.client.intlGet(guildId, 'unknown');
            options.push({
                label: `${langLong} (${langShort})`,
                description: Client.client.intlGet(guildId, 'setBotLanguage', {
                    language: `${langLong} (${langShort})`,
                }),
                value: langShort,
            });
        }

        let currentLanguage = Object.keys(Languages).find((e) => Languages[e] === language);
        if (!currentLanguage) currentLanguage = Client.client.intlGet(guildId, 'unknown');

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
                placeholder: Client.client.intlGet(guildId, 'currentPrefixPlaceholder', { prefix: prefix }),
                options: [
                    { label: '!', description: Client.client.intlGet(guildId, 'exclamationMark'), value: '!' },
                    { label: '?', description: Client.client.intlGet(guildId, 'questionMark'), value: '?' },
                    { label: '.', description: Client.client.intlGet(guildId, 'dot'), value: '.' },
                    { label: ':', description: Client.client.intlGet(guildId, 'colon'), value: ':' },
                    { label: ',', description: Client.client.intlGet(guildId, 'comma'), value: ',' },
                    { label: ';', description: Client.client.intlGet(guildId, 'semicolon'), value: ';' },
                    { label: '-', description: Client.client.intlGet(guildId, 'dash'), value: '-' },
                    { label: '_', description: Client.client.intlGet(guildId, 'underscore'), value: '_' },
                    { label: '=', description: Client.client.intlGet(guildId, 'equalsSign'), value: '=' },
                    { label: '*', description: Client.client.intlGet(guildId, 'asterisk'), value: '*' },
                    { label: '@', description: Client.client.intlGet(guildId, 'atSign'), value: '@' },
                    { label: '+', description: Client.client.intlGet(guildId, 'plusSign'), value: '+' },
                    { label: "'", description: Client.client.intlGet(guildId, 'apostrophe'), value: "'" },
                    { label: '#', description: Client.client.intlGet(guildId, 'hash'), value: '#' },
                    { label: '¤', description: Client.client.intlGet(guildId, 'currencySign'), value: '¤' },
                    { label: '%', description: Client.client.intlGet(guildId, 'percentSign'), value: '%' },
                    { label: '&', description: Client.client.intlGet(guildId, 'ampersand'), value: '&' },
                    { label: '|', description: Client.client.intlGet(guildId, 'pipe'), value: '|' },
                    { label: '>', description: Client.client.intlGet(guildId, 'greaterThanSign'), value: '>' },
                    { label: '<', description: Client.client.intlGet(guildId, 'lessThanSign'), value: '<' },
                    { label: '~', description: Client.client.intlGet(guildId, 'tilde'), value: '~' },
                    { label: '^', description: Client.client.intlGet(guildId, 'circumflex'), value: '^' },
                    { label: '♥', description: Client.client.intlGet(guildId, 'heart'), value: '♥' },
                    { label: '☺', description: Client.client.intlGet(guildId, 'smilyFace'), value: '☺' },
                    { label: '/', description: Client.client.intlGet(guildId, 'slash'), value: '/' },
                ],
            }),
        );
    },

    getTrademarkOption: function (guildId, trademark) {
        return {
            label: trademark,
            description: Client.client.intlGet(guildId, 'trademarkShownBeforeMessage', {
                trademark: trademark,
            }),
            value: trademark,
        };
    },

    getTrademarkSelectMenu: function (guildId, trademark) {
        return new Discord.ActionRowBuilder().addComponents(
            module.exports.getSelectMenu({
                customId: 'Trademark',
                placeholder: `${
                    trademark === 'NOT SHOWING' ? Client.client.intlGet(guildId, 'notShowingCap') : trademark
                }`,
                options: [
                    module.exports.getTrademarkOption(guildId, 'rustplusplus'),
                    module.exports.getTrademarkOption(guildId, 'Rust++'),
                    module.exports.getTrademarkOption(guildId, 'R++'),
                    module.exports.getTrademarkOption(guildId, 'RPP'),
                    module.exports.getTrademarkOption(guildId, 'BOT'),
                    {
                        label: Client.client.intlGet(guildId, 'notShowingCap'),
                        description: Client.client.intlGet(guildId, 'hideTrademark'),
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
                placeholder: Client.client.intlGet(guildId, 'currentCommandDelay', { delay: delay }),
                options: [
                    {
                        label: Client.client.intlGet(guildId, 'noDelayCap'),
                        description: Client.client.intlGet(guildId, 'noCommandDelay'),
                        value: '0',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'second', { second: '1' }),
                        description: Client.client.intlGet(guildId, 'secondCommandDelay', {
                            second: Client.client.intlGet(guildId, 'one'),
                        }),
                        value: '1',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'seconds', { seconds: '2' }),
                        description: Client.client.intlGet(guildId, 'secondsCommandDelay', {
                            seconds: Client.client.intlGet(guildId, 'two'),
                        }),
                        value: '2',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'seconds', { seconds: '3' }),
                        description: Client.client.intlGet(guildId, 'secondsCommandDelay', {
                            seconds: Client.client.intlGet(guildId, 'three'),
                        }),
                        value: '3',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'seconds', { seconds: '4' }),
                        description: Client.client.intlGet(guildId, 'secondsCommandDelay', {
                            seconds: Client.client.intlGet(guildId, 'four'),
                        }),
                        value: '4',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'seconds', { seconds: '5' }),
                        description: Client.client.intlGet(guildId, 'secondsCommandDelay', {
                            seconds: Client.client.intlGet(guildId, 'five'),
                        }),
                        value: '5',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'seconds', { seconds: '6' }),
                        description: Client.client.intlGet(guildId, 'secondsCommandDelay', {
                            seconds: Client.client.intlGet(guildId, 'six'),
                        }),
                        value: '6',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'seconds', { seconds: '7' }),
                        description: Client.client.intlGet(guildId, 'secondsCommandDelay', {
                            seconds: Client.client.intlGet(guildId, 'seven'),
                        }),
                        value: '7',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'seconds', { seconds: '8' }),
                        description: Client.client.intlGet(guildId, 'secondsCommandDelay', {
                            seconds: Client.client.intlGet(guildId, 'eight'),
                        }),
                        value: '8',
                    },
                ],
            }),
        );
    },

    getSmartSwitchSelectMenu: function (guildId, serverId, entityId) {
        const instance = Client.client.getInstance(guildId);
        const entity = instance.serverList[serverId].switches[entityId];
        const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

        const autoSetting = Client.client.intlGet(guildId, 'autoSettingCap');
        const off = Client.client.intlGet(guildId, 'offCap');
        const autoDay = Client.client.intlGet(guildId, 'autoDayCap');
        const autoNight = Client.client.intlGet(guildId, 'autoNightCap');
        const autoOn = Client.client.intlGet(guildId, 'autoOnCap');
        const autoOff = Client.client.intlGet(guildId, 'autoOffCap');
        const autoOnProximity = Client.client.intlGet(guildId, 'autoOnProximityCap');
        const autoOffProximity = Client.client.intlGet(guildId, 'autoOffProximityCap');
        const autoOnAnyOnline = Client.client.intlGet(guildId, 'autoOnAnyOnlineCap');
        const autoOffAnyOnline = Client.client.intlGet(guildId, 'autoOffAnyOnlineCap');

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
                        description: Client.client.intlGet(guildId, 'smartSwitchNormal'),
                        value: '0',
                    },
                    {
                        label: autoDay,
                        description: Client.client.intlGet(guildId, 'smartSwitchAutoDay'),
                        value: '1',
                    },
                    {
                        label: autoNight,
                        description: Client.client.intlGet(guildId, 'smartSwitchAutoNight'),
                        value: '2',
                    },
                    {
                        label: autoOn,
                        description: Client.client.intlGet(guildId, 'smartSwitchAutoOn'),
                        value: '3',
                    },
                    {
                        label: autoOff,
                        description: Client.client.intlGet(guildId, 'smartSwitchAutoOff'),
                        value: '4',
                    },
                    {
                        label: autoOnProximity,
                        description: Client.client.intlGet(guildId, 'smartSwitchAutoOnProximity'),
                        value: '5',
                    },
                    {
                        label: autoOffProximity,
                        description: Client.client.intlGet(guildId, 'smartSwitchAutoOffProximity'),
                        value: '6',
                    },
                    {
                        label: autoOnAnyOnline,
                        description: Client.client.intlGet(guildId, 'smartSwitchAutoOnAnyOnline'),
                        value: '7',
                    },
                    {
                        label: autoOffAnyOnline,
                        description: Client.client.intlGet(guildId, 'smartSwitchAutoOffAnyOnline'),
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
                        ? Client.client.intlGet(guildId, 'commandsVoiceMale')
                        : Client.client.intlGet(guildId, 'commandsVoiceFemale')
                }`,
                options: [
                    {
                        label: Client.client.intlGet(guildId, 'commandsVoiceMale'),
                        description: Client.client.intlGet(guildId, 'commandsVoiceMaleDescription'),
                        value: 'male',
                    },
                    {
                        label: Client.client.intlGet(guildId, 'commandsVoiceFemale'),
                        description: Client.client.intlGet(guildId, 'commandsVoiceFemaleDescription'),
                        value: 'female',
                    },
                ],
            }),
        );
    },
};
