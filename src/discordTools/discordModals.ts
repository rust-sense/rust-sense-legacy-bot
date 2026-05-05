import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

import { client } from '../index.js';
import { getPersistenceCache } from '../persistence/index.js';
import * as TextInput from './discordTextInputs.js';

interface ModalOptions {
    customId?: string;
    title?: string;
}

export function getModal(options: ModalOptions = {}) {
    const modal = new ModalBuilder();

    if (Object.hasOwn(options, 'customId')) modal.setCustomId(options.customId!);
    if (Object.hasOwn(options, 'title')) modal.setTitle(options.title!.slice(0, 45));

    return modal;
}

export async function getServerEditModal(guildId: string, serverId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const server = instance.serverList[serverId];
    const identifier = JSON.stringify({ serverId: serverId });

    const modal = getModal({
        customId: `ServerEdit${identifier}`,
        title: client.intlGet(guildId, 'editing'),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'ServerBattlemetricsId',
                label: client.intlGet(guildId, 'battlemetricsId'),
                value: server.battlemetricsId === null ? '' : server.battlemetricsId,
                style: TextInputStyle.Short,
                required: false,
                minLength: 0,
            }),
        ),
    );

    return modal;
}

export async function getCustomTimersEditModal(guildId: string, serverId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const server = instance.serverList[serverId];
    const identifier = JSON.stringify({ serverId: serverId });

    const modal = getModal({
        customId: `CustomTimersEdit${identifier}`,
        title: client.intlGet(guildId, 'customTimerEditDesc'),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'CargoShipEgressTime',
                label: client.intlGet(guildId, 'customTimerEditCargoShipEgressLabel'),
                value: `${server.cargoShipEgressTimeMs / 1000}`,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'OilRigCrateUnlockTime',
                label: client.intlGet(guildId, 'customTimerEditCrateOilRigUnlockLabel'),
                value: `${server.oilRigLockedCrateUnlockTimeMs / 1000}`,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'DeepSeaMinWipeCooldownTime',
                label: client.intlGet(guildId, 'customTimerEditDeepSeaMinWipeCooldownLabel'),
                value: `${server.deepSeaMinWipeCooldownMs / 1000}`,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'DeepSeaMaxWipeCooldownTime',
                label: client.intlGet(guildId, 'customTimerEditDeepSeaMaxWipeCooldownLabel'),
                value: `${server.deepSeaMaxWipeCooldownMs / 1000}`,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'DeepSeaWipeDurationTime',
                label: client.intlGet(guildId, 'customTimerEditDeepSeaWipeDurationLabel'),
                value: `${server.deepSeaWipeDurationMs / 1000}`,
                style: TextInputStyle.Short,
            }),
        ),
    );

    return modal;
}

export async function getSmartSwitchEditModal(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].switches[entityId];
    const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

    const modal = getModal({
        customId: `SmartSwitchEdit${identifier}`,
        title: client.intlGet(guildId, 'editingOf', {
            entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name,
        }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'SmartSwitchName',
                label: client.intlGet(guildId, 'name'),
                value: entity.name,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'SmartSwitchCommand',
                label: client.intlGet(guildId, 'customCommand'),
                value: entity.command,
                style: TextInputStyle.Short,
            }),
        ),
    );

    if (entity.autoDayNightOnOff === 5 || entity.autoDayNightOnOff === 6) {
        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                TextInput.getTextInput({
                    customId: 'SmartSwitchProximity',
                    label: client.intlGet(guildId, 'smartSwitchEditProximityLabel'),
                    value: `${entity.proximity}`,
                    style: TextInputStyle.Short,
                }),
            ),
        );
    }

    return modal;
}

export async function getGroupEditModal(guildId: string, serverId: string, groupId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const group = instance.serverList[serverId].switchGroups[groupId];
    const identifier = JSON.stringify({ serverId: serverId, groupId: groupId });

    const modal = getModal({
        customId: `GroupEdit${identifier}`,
        title: client.intlGet(guildId, 'editingOf', {
            entity: group.name.length > 18 ? `${group.name.slice(0, 18)}..` : group.name,
        }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'GroupName',
                label: client.intlGet(guildId, 'name'),
                value: group.name,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'GroupCommand',
                label: client.intlGet(guildId, 'customCommand'),
                value: group.command,
                style: TextInputStyle.Short,
            }),
        ),
    );

    return modal;
}

export async function getGroupAddSwitchModal(guildId: string, serverId: string, groupId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const group = instance.serverList[serverId].switchGroups[groupId];
    const identifier = JSON.stringify({ serverId: serverId, groupId: groupId });

    const modal = getModal({
        customId: `GroupAddSwitch${identifier}`,
        title: client.intlGet(guildId, 'groupAddSwitchDesc', { group: group.name }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'GroupAddSwitchId',
                label: client.intlGet(guildId, 'entityId'),
                value: '',
                style: TextInputStyle.Short,
            }),
        ),
    );

    return modal;
}

export async function getGroupRemoveSwitchModal(guildId: string, serverId: string, groupId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const group = instance.serverList[serverId].switchGroups[groupId];
    const identifier = JSON.stringify({ serverId: serverId, groupId: groupId });

    const modal = getModal({
        customId: `GroupRemoveSwitch${identifier}`,
        title: client.intlGet(guildId, 'groupRemoveSwitchDesc', { group: group.name }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'GroupRemoveSwitchId',
                label: client.intlGet(guildId, 'entityId'),
                value: '',
                style: TextInputStyle.Short,
            }),
        ),
    );

    return modal;
}

export async function getSmartAlarmEditModal(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].alarms[entityId];
    const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

    const modal = getModal({
        customId: `SmartAlarmEdit${identifier}`,
        title: client.intlGet(guildId, 'editingOf', {
            entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name,
        }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'SmartAlarmName',
                label: client.intlGet(guildId, 'name'),
                value: entity.name,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'SmartAlarmMessage',
                label: client.intlGet(guildId, 'message'),
                value: entity.message,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'SmartAlarmCommand',
                label: client.intlGet(guildId, 'customCommand'),
                value: entity.command,
                style: TextInputStyle.Short,
            }),
        ),
    );

    return modal;
}

export async function getStorageMonitorEditModal(guildId: string, serverId: string, entityId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const entity = instance.serverList[serverId].storageMonitors[entityId];
    const identifier = JSON.stringify({ serverId: serverId, entityId: entityId });

    const modal = getModal({
        customId: `StorageMonitorEdit${identifier}`,
        title: client.intlGet(guildId, 'editingOf', {
            entity: entity.name.length > 18 ? `${entity.name.slice(0, 18)}..` : entity.name,
        }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'StorageMonitorName',
                label: client.intlGet(guildId, 'name'),
                value: entity.name,
                style: TextInputStyle.Short,
            }),
        ),
    );

    return modal;
}

export async function getTrackerEditModal(guildId: string, trackerId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const tracker = instance.trackers[trackerId];
    const identifier = JSON.stringify({ trackerId: trackerId });

    const modal = getModal({
        customId: `TrackerEdit${identifier}`,
        title: client.intlGet(guildId, 'editingOf', {
            entity: tracker.name.length > 18 ? `${tracker.name.slice(0, 18)}..` : tracker.name,
        }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'TrackerName',
                label: client.intlGet(guildId, 'name'),
                value: tracker.name,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'TrackerBattlemetricsId',
                label: client.intlGet(guildId, 'battlemetricsId'),
                value: tracker.battlemetricsId,
                style: TextInputStyle.Short,
            }),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'TrackerClanTag',
                label: client.intlGet(guildId, 'clanTag'),
                value: tracker.clanTag,
                style: TextInputStyle.Short,
                required: false,
                minLength: 0,
            }),
        ),
    );

    return modal;
}

export async function getTrackerAddPlayerModal(guildId: string, trackerId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const tracker = instance.trackers[trackerId];
    const identifier = JSON.stringify({ trackerId: trackerId });

    const modal = getModal({
        customId: `TrackerAddPlayer${identifier}`,
        title: client.intlGet(guildId, 'trackerAddPlayerDesc', { tracker: tracker.name }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'TrackerAddPlayerId',
                label: `${client.intlGet(guildId, 'steamId')} / ` + `${client.intlGet(guildId, 'battlemetricsId')}`,
                value: '',
                style: TextInputStyle.Short,
            }),
        ),
    );

    return modal;
}

export async function getTrackerRemovePlayerModal(guildId: string, trackerId: string) {
    const instance = await getPersistenceCache().readGuildState(guildId);
    const tracker = instance.trackers[trackerId];
    const identifier = JSON.stringify({ trackerId: trackerId });

    const modal = getModal({
        customId: `TrackerRemovePlayer${identifier}`,
        title: client.intlGet(guildId, 'trackerRemovePlayerDesc', { tracker: tracker.name }),
    });

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            TextInput.getTextInput({
                customId: 'TrackerRemovePlayerId',
                label: `${client.intlGet(guildId, 'steamId')} / ` + `${client.intlGet(guildId, 'battlemetricsId')}`,
                value: '',
                style: TextInputStyle.Short,
            }),
        ),
    );

    return modal;
}
