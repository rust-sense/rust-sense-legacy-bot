const Discord = require('discord.js');

import { client } from '../index';
const TextInput = require('./discordTextInputs');

module.exports = {
    getModal: function (options = {}) {
        const modal = new Discord.ModalBuilder();

        if (options.hasOwnProperty('customId')) modal.setCustomId(options.customId);
        if (options.hasOwnProperty('title')) modal.setTitle(options.title.slice(0, 45));

        return modal;
    },

    getServerEditModal(guildId, serverId) {
        const instance = client.getInstance(guildId);
        const server = instance.serverList[serverId];
        const identifier = JSON.stringify({ serverId: serverId });

        const modal = module.exports.getModal({
            customId: `ServerEdit${identifier}`,
            title: client.intlGet(guildId, 'editing'),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'ServerBattlemetricsId',
                    label: client.intlGet(guildId, 'battlemetricsId'),
                    value: server.battlemetricsId === null ? '' : server.battlemetricsId,
                    style: Discord.TextInputStyle.Short,
                    required: false,
                    minLength: 0,
                }),
            ),
        );

        return modal;
    },

    getCustomTimersEditModal(guildId, serverId) {
        const instance = client.getInstance(guildId);
        const server = instance.serverList[serverId];
        const identifier = JSON.stringify({ serverId: serverId });

        const modal = module.exports.getModal({
            customId: `CustomTimersEdit${identifier}`,
            title: client.intlGet(guildId, 'customTimerEditDesc'),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'CargoShipEgressTime',
                    label: client.intlGet(guildId, 'customTimerEditCargoShipEgressLabel'),
                    value: `${server.cargoShipEgressTimeMs / 1000}`,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'OilRigCrateUnlockTime',
                    label: client.intlGet(guildId, 'customTimerEditCrateOilRigUnlockLabel'),
                    value: `${server.oilRigLockedCrateUnlockTimeMs / 1000}`,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        return modal;
    },

    getSmartSwitchEditModal(guildId, serverId, entityId) {
        const instance = client.getInstance(guildId);
        const entity = instance.serverList[serverId].switches[entityId];
        const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

        const modal = module.exports.getModal({
            customId: `SmartSwitchEdit${identifier}`,
            title: client.intlGet(guildId, 'editingOf', {
                entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name,
            }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'SmartSwitchName',
                    label: client.intlGet(guildId, 'name'),
                    value: entity.name,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'SmartSwitchCommand',
                    label: client.intlGet(guildId, 'customCommand'),
                    value: entity.command,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        if (entity.autoDayNightOnOff === 5 || entity.autoDayNightOnOff === 6) {
            modal.addComponents(
                new Discord.ActionRowBuilder().addComponents(
                    TextInput.getTextInput({
                        customId: 'SmartSwitchProximity',
                        label: client.intlGet(guildId, 'smartSwitchEditProximityLabel'),
                        value: `${entity.proximity}`,
                        style: Discord.TextInputStyle.Short,
                    }),
                ),
            );
        }

        return modal;
    },

    getGroupEditModal(guildId, serverId, groupId) {
        const instance = client.getInstance(guildId);
        const group = instance.serverList[serverId].switchGroups[groupId];
        const identifier = JSON.stringify({ serverId: serverId, groupId: groupId });

        const modal = module.exports.getModal({
            customId: `GroupEdit${identifier}`,
            title: client.intlGet(guildId, 'editingOf', {
                entity: group.name.length > 18 ? `${group.name.slice(0, 18)}..` : group.name,
            }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'GroupName',
                    label: client.intlGet(guildId, 'name'),
                    value: group.name,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'GroupCommand',
                    label: client.intlGet(guildId, 'customCommand'),
                    value: group.command,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        return modal;
    },

    getGroupAddSwitchModal(guildId, serverId, groupId) {
        const instance = client.getInstance(guildId);
        const group = instance.serverList[serverId].switchGroups[groupId];
        const identifier = JSON.stringify({ serverId: serverId, groupId: groupId });

        const modal = module.exports.getModal({
            customId: `GroupAddSwitch${identifier}`,
            title: client.intlGet(guildId, 'groupAddSwitchDesc', { group: group.name }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'GroupAddSwitchId',
                    label: client.intlGet(guildId, 'entityId'),
                    value: '',
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        return modal;
    },

    getGroupRemoveSwitchModal(guildId, serverId, groupId) {
        const instance = client.getInstance(guildId);
        const group = instance.serverList[serverId].switchGroups[groupId];
        const identifier = JSON.stringify({ serverId: serverId, groupId: groupId });

        const modal = module.exports.getModal({
            customId: `GroupRemoveSwitch${identifier}`,
            title: client.intlGet(guildId, 'groupRemoveSwitchDesc', { group: group.name }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'GroupRemoveSwitchId',
                    label: client.intlGet(guildId, 'entityId'),
                    value: '',
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        return modal;
    },

    getSmartAlarmEditModal(guildId, serverId, entityId) {
        const instance = client.getInstance(guildId);
        const entity = instance.serverList[serverId].alarms[entityId];
        const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

        const modal = module.exports.getModal({
            customId: `SmartAlarmEdit${identifier}`,
            title: client.intlGet(guildId, 'editingOf', {
                entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name,
            }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'SmartAlarmName',
                    label: client.intlGet(guildId, 'name'),
                    value: entity.name,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'SmartAlarmMessage',
                    label: client.intlGet(guildId, 'message'),
                    value: entity.message,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'SmartAlarmCommand',
                    label: client.intlGet(guildId, 'customCommand'),
                    value: entity.command,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        return modal;
    },

    getStorageMonitorEditModal(guildId, serverId, entityId) {
        const instance = client.getInstance(guildId);
        const entity = instance.serverList[serverId].storageMonitors[entityId];
        const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

        const modal = module.exports.getModal({
            customId: `StorageMonitorEdit${identifier}`,
            title: client.intlGet(guildId, 'editingOf', {
                entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name,
            }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'StorageMonitorName',
                    label: client.intlGet(guildId, 'name'),
                    value: entity.name,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        return modal;
    },

    getTrackerEditModal(guildId, trackerId) {
        const instance = client.getInstance(guildId);
        const tracker = instance.trackers[trackerId];
        const identifier = JSON.stringify({ trackerId: trackerId });

        const modal = module.exports.getModal({
            customId: `TrackerEdit${identifier}`,
            title: client.intlGet(guildId, 'editingOf', {
                entity: tracker.name.length > 18 ? `${tracker.name.slice(0, 18)}..` : tracker.name,
            }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'TrackerName',
                    label: client.intlGet(guildId, 'name'),
                    value: tracker.name,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'TrackerBattlemetricsId',
                    label: client.intlGet(guildId, 'battlemetricsId'),
                    value: tracker.battlemetricsId,
                    style: Discord.TextInputStyle.Short,
                }),
            ),
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'TrackerClanTag',
                    label: client.intlGet(guildId, 'clanTag'),
                    value: tracker.clanTag,
                    style: Discord.TextInputStyle.Short,
                    required: false,
                    minLength: 0,
                }),
            ),
        );

        return modal;
    },

    getTrackerAddPlayerModal(guildId, trackerId) {
        const instance = client.getInstance(guildId);
        const tracker = instance.trackers[trackerId];
        const identifier = JSON.stringify({ trackerId: trackerId });

        const modal = module.exports.getModal({
            customId: `TrackerAddPlayer${identifier}`,
            title: client.intlGet(guildId, 'trackerAddPlayerDesc', { tracker: tracker.name }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'TrackerAddPlayerId',
                    label: `${client.intlGet(guildId, 'steamId')} / ` + `${client.intlGet(guildId, 'battlemetricsId')}`,
                    value: '',
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        return modal;
    },

    getTrackerRemovePlayerModal(guildId, trackerId) {
        const instance = client.getInstance(guildId);
        const tracker = instance.trackers[trackerId];
        const identifier = JSON.stringify({ trackerId: trackerId });

        const modal = module.exports.getModal({
            customId: `TrackerRemovePlayer${identifier}`,
            title: client.intlGet(guildId, 'trackerRemovePlayerDesc', { tracker: tracker.name }),
        });

        modal.addComponents(
            new Discord.ActionRowBuilder().addComponents(
                TextInput.getTextInput({
                    customId: 'TrackerRemovePlayerId',
                    label: `${client.intlGet(guildId, 'steamId')} / ` + `${client.intlGet(guildId, 'battlemetricsId')}`,
                    value: '',
                    style: Discord.TextInputStyle.Short,
                }),
            ),
        );

        return modal;
    },
};
