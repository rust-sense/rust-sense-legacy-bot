import fs from 'node:fs';
import path from 'node:path';
import { createIntl, createIntlCache } from '@formatjs/intl';
import * as Discord from 'discord.js';
import { IntlMessageFormat } from 'intl-messageformat';
import config from '../config.js';
import discordCommands from '../discordCommands/index.js';
import discordEvents from '../discordEvents/index.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as PermissionHandler from '../handlers/permissionHandler.js';
import { getPersistenceCache } from '../persistence/index.js';
import Battlemetrics from '../structures/Battlemetrics.js';
import RustLabs from '../structures/RustLabs.js';
import RustPlus from '../structures/RustPlus.js';
import type { DiscordEvent } from '../types/discord.js';
import * as Constants from '../util/constants.js';
import * as InstanceUtils from '../util/instanceUtils.js';
import { cwdPath, loadJsonResourceSync } from '../utils/filesystemUtils.js';
import Cctv from './Cctv.js';
import Items from './Items.js';
import Logger from './Logger.js';

export default class DiscordBot extends Discord.Client {
    logger: Logger;
    commands: Discord.Collection<string, unknown>;
    fcmListeners: Record<string, { destroy: () => void }> = {};
    fcmListenersLite: Record<string, Record<string, { destroy: () => void }>> = {};
    instances: Record<string, import('../types/instance.js').Instance> = {};
    intlInstances: Record<string, ReturnType<typeof createIntl>> = {};
    customGuildIntl: Record<string, Record<string, IntlMessageFormat>> = {};
    rustplusInstances: Record<string, RustPlus> = {};
    activeRustplusInstances: Record<string, boolean> = {};
    rustplusReconnectTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
    rustplusLiteReconnectTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
    rustplusReconnecting: Record<string, boolean> = {};
    rustplusMaps: Record<string, unknown> = {};
    uptimeBot: Date | null = null;
    items: Items;
    rustlabs: RustLabs;
    cctv: Cctv;
    pollingIntervalMs: number;
    battlemetricsInstances: Record<string, Battlemetrics> = {};
    battlemetricsIntervalId: ReturnType<typeof setInterval> | null = null;
    battlemetricsIntervalCounter = 0;
    voiceLeaveTimeouts: Record<string, ReturnType<typeof setTimeout> | null> = {};
    localeCache: ReturnType<typeof createIntlCache>;

    constructor(props: Discord.ClientOptions) {
        super(props);

        this.logger = new Logger('discordBot.log');

        this.commands = new Discord.Collection();

        this.pollingIntervalMs = config.general.pollingIntervalMs;

        this.items = new Items();
        this.rustlabs = new RustLabs();
        this.cctv = new Cctv();

        this.loadDiscordCommands();
        this.loadDiscordEvents();
        this.setupIntl();
    }

    loadDiscordCommands(): void {
        for (const command of discordCommands) {
            this.commands.set(command.name, command);
        }
    }

    loadDiscordEvents(): void {
        for (const event of discordEvents as DiscordEvent[]) {
            const handler = (...args: unknown[]) => event.execute(this, ...args);
            if (event.name === 'rateLimited') {
                this.rest.on(event.name, handler);
            } else if ((event as { once?: boolean }).once) {
                this.once(event.name, handler);
            } else {
                this.on(event.name, handler);
            }
        }
    }

    setupIntl(): void {
        this.localeCache = createIntlCache();

        // Load english intl
        this.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);

        // Load bot intl
        this.checkLocaleIntlLoad(config.general.language);
    }

    createIntlForLocale(locale: string): ReturnType<typeof createIntl> {
        const messages = loadJsonResourceSync<Record<string, string>>(`languages/${locale}.json`);

        const intlConfig = {
            locale,
            messages,
            defaultLocale: Constants.DEFAULT_LOCALE,
        };

        return createIntl(intlConfig, this.localeCache);
    }

    checkLocaleIntlLoad(locale: string): ReturnType<typeof createIntl> {
        if (locale in this.intlInstances) {
            return this.intlInstances[locale];
        }

        const intlInstance = this.createIntlForLocale(locale);
        this.intlInstances[locale] = intlInstance;

        return intlInstance;
    }

    loadGuildIntl(guildId: string, instance: import('../types/instance.js').Instance): void {
        this.checkLocaleIntlLoad(instance.generalSettings.language);

        for (const [key, message] of Object.entries(instance.customIntlMessages)) {
            this.loadGuildCustomIntl(guildId, instance, key, message);
        }
    }

    loadGuildCustomIntl(
        guildId: string,
        instance: import('../types/instance.js').Instance,
        key: string,
        message: string,
    ): void {
        if (!(guildId in this.customGuildIntl)) {
            this.customGuildIntl[guildId] = {};
        }

        const messageFormat = new IntlMessageFormat(message, instance.generalSettings.language);
        this.customGuildIntl[guildId][key] = messageFormat;
    }

    loadGuildsIntlFromCache(): void {
        for (const guild of this.guilds.cache) {
            const guildId = guild[0];
            const instance = InstanceUtils.readInstanceFile(guildId);
            this.loadGuildIntl(guildId, instance);
        }
    }

    formatWithIntl(
        intlInstance: ReturnType<typeof createIntl>,
        id: string,
        variables: Record<string, unknown> = {},
    ): string {
        const englishIntl = this.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);
        const messages = englishIntl.messages as Record<string, string>;
        const defaultMessage = messages[id];

        return intlInstance.formatMessage(
            { id, defaultMessage },
            variables as Record<string, string | number | Date | boolean>,
        ) as string;
    }

    intlGet(guildId: string | null, id: string, variables: Record<string, unknown> = {}): string {
        // Bot Intl formatting
        if (guildId === null) {
            const intlInstance = this.checkLocaleIntlLoad(config.general.language);
            return this.formatWithIntl(intlInstance, id, variables);
        }

        // English Intl formatting
        if (guildId === Constants.DEFAULT_LOCALE) {
            const intlInstance = this.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);
            return this.formatWithIntl(intlInstance, id, variables);
        }

        // Guild custom Intl formatting
        if (guildId in this.customGuildIntl && id in this.customGuildIntl[guildId]) {
            const messageFormat = this.customGuildIntl[guildId][id];
            return messageFormat.format(variables) as string;
        }

        // Guild Intl instance formatting
        const instance = this.getInstance(guildId);
        const intlInstance = this.checkLocaleIntlLoad(instance.generalSettings.language);
        return this.formatWithIntl(intlInstance, id, variables);
    }

    build(): void {
        this.login(config.discord.token).catch((error: any) => {
            switch (error.code) {
                case 502:
                    {
                        this.log(
                            this.intlGet(null, 'errorCap'),
                            this.intlGet(null, 'badGateway', { error: JSON.stringify(error) }),
                            'error',
                        );
                    }
                    break;

                case 503:
                    {
                        this.log(
                            this.intlGet(null, 'errorCap'),
                            this.intlGet(null, 'serviceUnavailable', { error: JSON.stringify(error) }),
                            'error',
                        );
                    }
                    break;

                default:
                    {
                        this.log(this.intlGet(null, 'errorCap'), `${JSON.stringify(error)}`, 'error');
                    }
                    break;
            }
        });
    }

    log(title: string, text: string, level = 'info'): void {
        this.logger.log(title, text, level);
    }

    logInteraction(interaction: any, verifyId: string, type: string): void {
        const channel = DiscordTools.getTextChannelById(interaction.guildId, interaction.channelId);
        const args: Record<string, string> = {};
        args['guild'] = `${interaction.member.guild.name} (${interaction.member.guild.id})`;
        args['channel'] = `${channel?.name} (${interaction.channelId})`;
        args['user'] = `${interaction.user.username} (${interaction.user.id})`;
        args[type === 'slashCommand' ? 'command' : 'customid'] =
            type === 'slashCommand' ? `${interaction.commandName}` : `${interaction.customId}`;
        args['id'] = `${verifyId}`;

        this.log(this.intlGet(null, 'infoCap'), this.intlGet(null, `${type}Interaction`, args));
    }

    async setupGuild(guild: any): Promise<void> {
        const instance = this.getInstance(guild.id);
        const firstTime = instance.firstTime;

        const registerSlashCommands = (await import('../discordTools/RegisterSlashCommands.js')).default;
        await registerSlashCommands(this, guild);

        const setupGuildCategory = (await import('../discordTools/SetupGuildCategory.js')).default;
        const category = await setupGuildCategory(this, guild);

        const setupGuildChannels = (await import('../discordTools/SetupGuildChannels.js')).default;
        await setupGuildChannels(this, guild, category);

        if (firstTime) {
            const perms = PermissionHandler.getPermissionsRemoved(this, guild);
            try {
                await category.permissionOverwrites.set(perms);
            } catch (e) {
                /* Ignore */
            }
        } else {
            await PermissionHandler.resetPermissionsAllChannels(this, guild);
        }

        const FcmListener = (await import('../util/FcmListener.js')).default;
        FcmListener(this, guild);

        const credentials = InstanceUtils.readCredentialsFile(guild.id);
        for (const steamId of Object.keys(credentials)) {
            if (steamId !== credentials.hoster && steamId !== 'hoster') {
                FcmListener(this, guild, steamId);
            }
        }

        const setupSettingsMenu = (await import('../discordTools/SetupSettingsMenu.js')).default;
        await setupSettingsMenu(this, guild);

        if (firstTime) await PermissionHandler.resetPermissionsAllChannels(this, guild);

        this.resetRustplusVariables(guild.id);
    }

    async syncCredentialsWithUsers(guild: any): Promise<void> {
        const credentials = InstanceUtils.readCredentialsFile(guild.id);

        const members = await guild.members.fetch();
        const memberIds: string[] = [];
        for (const member of members) {
            memberIds.push(member[0]);
        }

        const steamIdRemoveCredentials: string[] = [];
        for (const [steamId, content] of Object.entries(credentials)) {
            if (steamId === 'hoster') continue;
            if (typeof content !== 'object' || content === null) continue;

            if (!memberIds.includes((content as { discord_user_id: string }).discord_user_id)) {
                steamIdRemoveCredentials.push(steamId);
            }
        }

        for (const steamId of steamIdRemoveCredentials) {
            if (steamId === credentials.hoster) {
                if (this.fcmListeners[guild.id]) {
                    this.fcmListeners[guild.id].destroy();
                }
                delete this.fcmListeners[guild.id];
                credentials.hoster = null;
            } else {
                if (this.fcmListenersLite[guild.id]?.[steamId]) {
                    this.fcmListenersLite[guild.id][steamId].destroy();
                }
                if (this.fcmListenersLite[guild.id]) {
                    delete this.fcmListenersLite[guild.id][steamId];
                }
            }

            delete credentials[steamId];
        }

        InstanceUtils.writeCredentialsFile(guild.id, credentials);
    }

    getInstance(guildId: string): import('../types/instance.js').Instance {
        if (!(guildId in this.instances)) {
            this.instances[guildId] = InstanceUtils.readInstanceFile(guildId);
        }

        return this.instances[guildId];
    }

    setInstance(guildId: string, instance: import('../types/instance.js').Instance): void {
        this.instances[guildId] = instance;
        InstanceUtils.writeInstanceFile(guildId, instance);
    }

    readNotificationSettingsTemplate(): Record<string, unknown> {
        return loadJsonResourceSync('templates/notificationSettingsTemplate.json');
    }

    readGeneralSettingsTemplate(): Record<string, unknown> {
        return loadJsonResourceSync('templates/generalSettingsTemplate.json');
    }

    createRustplusInstance(
        guildId: string,
        serverIp: string,
        appPort: number,
        steamId: string,
        playerToken: string,
    ): RustPlus {
        const rustplus = new RustPlus(guildId, serverIp, appPort, steamId, playerToken);

        /* Add rustplus instance to Object */
        this.rustplusInstances[guildId] = rustplus;
        this.activeRustplusInstances[guildId] = true;

        rustplus.build();

        return rustplus;
    }

    createRustplusInstancesFromConfig(): void {
        for (const guildId of getPersistenceCache().listGuildIds()) {
            const instance = this.getInstance(guildId);
            if (!instance) {
                continue;
            }

            if (instance.activeServer !== null && Object.hasOwn(instance.serverList, instance.activeServer)) {
                this.createRustplusInstance(
                    guildId,
                    instance.serverList[instance.activeServer].serverIp,
                    instance.serverList[instance.activeServer].appPort,
                    instance.serverList[instance.activeServer].steamId,
                    instance.serverList[instance.activeServer].playerToken,
                );
            }
        }
    }

    deleteGuildState(guildId: string): void {
        this.fcmListeners[guildId]?.destroy();
        delete this.fcmListeners[guildId];

        for (const listener of Object.values(this.fcmListenersLite[guildId] ?? {})) {
            listener.destroy();
        }
        delete this.fcmListenersLite[guildId];

        this.rustplusInstances[guildId]?.deleteThisRustplusInstance();
        delete this.rustplusInstances[guildId];
        delete this.activeRustplusInstances[guildId];
        delete this.rustplusReconnecting[guildId];
        delete this.rustplusMaps[guildId];
        delete this.customGuildIntl[guildId];
        delete this.instances[guildId];

        if (this.rustplusReconnectTimers[guildId]) {
            clearTimeout(this.rustplusReconnectTimers[guildId]);
        }
        delete this.rustplusReconnectTimers[guildId];

        if (this.rustplusLiteReconnectTimers[guildId]) {
            clearTimeout(this.rustplusLiteReconnectTimers[guildId]);
        }
        delete this.rustplusLiteReconnectTimers[guildId];

        if (this.voiceLeaveTimeouts[guildId]) {
            clearTimeout(this.voiceLeaveTimeouts[guildId]);
        }
        delete this.voiceLeaveTimeouts[guildId];

        getPersistenceCache().deleteGuild(guildId);
    }

    resetRustplusVariables(guildId: string): void {
        this.activeRustplusInstances[guildId] = false;
        this.rustplusReconnecting[guildId] = false;
        delete this.rustplusMaps[guildId];

        if (this.rustplusReconnectTimers[guildId]) {
            clearTimeout(this.rustplusReconnectTimers[guildId]);
            this.rustplusReconnectTimers[guildId] = null;
        }
        if (this.rustplusLiteReconnectTimers[guildId]) {
            clearTimeout(this.rustplusLiteReconnectTimers[guildId]);
            this.rustplusLiteReconnectTimers[guildId] = null;
        }
    }

    isJpgImageChanged(guildId: string, map: any): boolean {
        return JSON.stringify(this.rustplusMaps[guildId]) !== JSON.stringify(map.jpgImage);
    }

    findAvailableTrackerId(guildId: string): number {
        const instance = this.getInstance(guildId);

        while (true) {
            const randomNumber = Math.floor(Math.random() * 1000);
            if (!Object.hasOwn(instance.trackers, randomNumber)) {
                return randomNumber;
            }
        }
    }

    findAvailableGroupId(guildId: string, serverId: string): number {
        const instance = this.getInstance(guildId);

        while (true) {
            const randomNumber = Math.floor(Math.random() * 1000);
            if (!Object.hasOwn(instance.serverList[serverId].switchGroups, randomNumber)) {
                return randomNumber;
            }
        }
    }

    /**
     *  Check if Battlemetrics instances are missing/not required/need update.
     */
    async updateBattlemetricsInstances(): Promise<void> {
        const activeInstances: string[] = [];

        /* Check for instances that are missing or need update. */
        for (const guild of this.guilds.cache) {
            const guildId = guild[0];
            const instance = this.getInstance(guildId);
            const activeServer = instance.activeServer;
            if (activeServer !== null && Object.hasOwn(instance.serverList, activeServer)) {
                if (instance.serverList[activeServer].battlemetricsId !== null) {
                    /* A Battlemetrics ID exist. */
                    const battlemetricsId = instance.serverList[activeServer].battlemetricsId;
                    if (!activeInstances.includes(battlemetricsId)) {
                        activeInstances.push(battlemetricsId);
                        if (Object.hasOwn(this.battlemetricsInstances, battlemetricsId)) {
                            /* Update */
                            await this.battlemetricsInstances[battlemetricsId].evaluation();
                        } else {
                            /* Add */
                            const bmInstance = new Battlemetrics();
                            bmInstance.id = battlemetricsId;
                            await bmInstance.setup();
                            this.battlemetricsInstances[battlemetricsId] = bmInstance;
                        }
                    }
                } else {
                    /* Battlemetrics ID is missing, try with server name. */
                    const name = instance.serverList[activeServer].title;
                    const bmInstance = new Battlemetrics();
                    bmInstance.id = null;
                    bmInstance.name = name;
                    await bmInstance.setup();
                    if (bmInstance.lastUpdateSuccessful) {
                        /* Found an Id, is it a new Id? */
                        instance.serverList[activeServer].battlemetricsId = bmInstance.id;
                        this.setInstance(guildId, instance);

                        if (Object.hasOwn(this.battlemetricsInstances, bmInstance.id as string)) {
                            if (!activeInstances.includes(bmInstance.id as string)) {
                                activeInstances.push(bmInstance.id as string);
                                await this.battlemetricsInstances[bmInstance.id as string].evaluation(bmInstance.data);
                            }
                        } else {
                            activeInstances.push(bmInstance.id as string);
                            this.battlemetricsInstances[bmInstance.id as string] = bmInstance;
                        }
                    }
                }
            }

            for (const [trackerId, content] of Object.entries(instance.trackers)) {
                if (!activeInstances.includes(content.battlemetricsId)) {
                    activeInstances.push(content.battlemetricsId);
                    if (Object.hasOwn(this.battlemetricsInstances, content.battlemetricsId)) {
                        /* Update */
                        await this.battlemetricsInstances[content.battlemetricsId].evaluation();
                    } else {
                        /* Add */
                        const bmInstance = new Battlemetrics();
                        bmInstance.id = content.battlemetricsId;
                        await bmInstance.setup();
                        this.battlemetricsInstances[content.battlemetricsId] = bmInstance;
                    }
                }
            }
        }

        /* Find instances that are no longer required and delete them. */
        const remove = Object.keys(this.battlemetricsInstances).filter((e) => !activeInstances.includes(e));
        for (const id of remove) {
            delete this.battlemetricsInstances[id];
        }
    }

    async interactionReply(interaction: any, content: any): Promise<any> {
        try {
            return await interaction.reply(content);
        } catch (e: any) {
            this.log(
                this.intlGet(null, 'errorCap'),
                this.intlGet(null, 'interactionReplyFailed', { error: e }),
                'error',
            );
        }

        return undefined;
    }

    async interactionEditReply(interaction: any, content: any): Promise<any> {
        try {
            return await interaction.editReply(content);
        } catch (e: any) {
            this.log(
                this.intlGet(null, 'errorCap'),
                this.intlGet(null, 'interactionEditReplyFailed', { error: e }),
                'error',
            );
        }

        return undefined;
    }

    async interactionUpdate(interaction: any, content: any): Promise<any> {
        try {
            return await interaction.update(content);
        } catch (e: any) {
            this.log(
                this.intlGet(null, 'errorCap'),
                this.intlGet(null, 'interactionUpdateFailed', { error: e }),
                'error',
            );
        }

        return undefined;
    }

    async messageEdit(message: any, content: any): Promise<any> {
        try {
            return await message.edit(content);
        } catch (e: any) {
            this.log(this.intlGet(null, 'errorCap'), this.intlGet(null, 'messageEditFailed', { error: e }), 'error');
        }

        return undefined;
    }

    async messageSend(channel: any, content: any): Promise<any> {
        try {
            return await channel.send(content);
        } catch (e: any) {
            this.log(this.intlGet(null, 'errorCap'), this.intlGet(null, 'messageSendFailed', { error: e }), 'error');
        }

        return undefined;
    }

    async messageReply(message: any, content: any): Promise<any> {
        try {
            return await message.reply(content);
        } catch (e: any) {
            this.log(this.intlGet(null, 'errorCap'), this.intlGet(null, 'messageReplyFailed', { error: e }), 'error');
        }

        return undefined;
    }

    generateVerifyId(): string {
        return Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, '0');
    }

    async resolveItemId(
        interaction: any,
        guildId: string,
        itemName: string | null,
        itemId: string | null,
    ): Promise<string | null> {
        const DiscordEmbeds = await import('../discordTools/discordEmbeds.js');
        if (itemName !== null) {
            const item = this.items.getClosestItemIdByName(itemName);
            if (item === null) {
                const str = this.intlGet(guildId, 'noItemWithNameFound', { name: itemName });
                await this.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
                this.log(this.intlGet(guildId, 'warningCap'), str);
                return null;
            }
            return item;
        } else if (itemId !== null) {
            if (this.items.itemExist(itemId)) {
                return itemId;
            }
            const str = this.intlGet(guildId, 'noItemWithIdFound', { id: itemId });
            await this.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            this.log(this.intlGet(guildId, 'warningCap'), str);
            return null;
        } else {
            const str = this.intlGet(guildId, 'noNameIdGiven');
            await this.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            this.log(this.intlGet(guildId, 'warningCap'), str);
            return null;
        }
    }

    async validatePermissions(interaction: any): Promise<boolean> {
        const instance = this.getInstance(interaction.guildId);

        // If user is blacklisted, admin or not, deny the interaction
        if (instance.blacklist['discordIds'].includes(interaction.user.id)) {
            return false;
        }

        // If role isn't setup yet, validate as true
        if (instance.role === null) {
            return true;
        }

        // If either admin or regular, allow the interaction
        if (!this.isAdministrator(interaction) && !interaction.member.roles.cache.has(instance.role)) {
            const role = DiscordTools.getRole(interaction.guildId, instance.role);
            const str = this.intlGet(interaction.guildId, 'notPartOfRole', { role: role?.name });
            await this.interactionReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            this.log(this.intlGet(null, 'warningCap'), str, 'warn');
            return false;
        }

        return true;
    }

    isAdministrator(interaction: any): boolean {
        const instance = this.getInstance(interaction.guildId);

        if (interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
            return true;
        }

        if (instance.adminRole !== null && interaction.member.roles.cache.has(instance.adminRole)) {
            return true;
        }

        if (config.discord.ownerUserId !== null && interaction.user.id === config.discord.ownerUserId) {
            return true;
        }

        return false;
    }
}
