// @ts-nocheck
import FormatJS from '@formatjs/intl';
import * as Discord from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';

import Battlemetrics from '../structures/Battlemetrics.js';
import Cctv from './Cctv.js';
import config from '../config.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as InstanceUtils from '../util/instanceUtils.js';
import Items from './Items.js';
import Logger from './Logger.js';
import * as PermissionHandler from '../handlers/permissionHandler.js';
import RustLabs from '../structures/RustLabs.js';
import RustPlus from '../structures/RustPlus.js';
import * as Constants from '../util/constants.js';

import discordCommands from '../discordCommands/index.js';
import discordEvents from '../discordEvents/index.js';
import { cwdPath, loadJsonResourceSync } from '../utils/filesystemUtils.js';

export default class DiscordBot extends Discord.Client {
    logger: Logger;
    commands: Discord.Collection<string, unknown>;
    fcmListeners: Record<string, unknown> = {};
    fcmListenersLite: Record<string, unknown> = {};
    instances: Record<string, unknown> = {};
    intlInstances: Record<string, unknown> = {};
    customGuildIntl: Record<string, unknown> = {};
    rustplusInstances: Record<string, unknown> = {};
    activeRustplusInstances: Record<string, unknown> = {};
    rustplusReconnectTimers: Record<string, unknown> = {};
    rustplusLiteReconnectTimers: Record<string, unknown> = {};
    rustplusReconnecting: Record<string, boolean> = {};
    rustplusMaps: Record<string, unknown> = {};
    uptimeBot: Date | null = null;
    items: Items;
    rustlabs: RustLabs;
    cctv: Cctv;
    pollingIntervalMs: number;
    battlemetricsInstances: Record<string, unknown> = {};
    battlemetricsIntervalId: ReturnType<typeof setInterval> | null = null;
    battlemetricsIntervalCounter = 0;
    voiceLeaveTimeouts: Record<string, unknown> = {};
    localeCache: ReturnType<typeof FormatJS.createIntlCache>;

    constructor(props: Discord.ClientOptions) {
        super(props);

        this.logger = new Logger(cwdPath('logs/discordBot.log'), 'default');

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
        for (const event of discordEvents) {
            if (event.name === 'rateLimited') {
                this.rest.on(event.name, (...args: unknown[]) => event.execute(this, ...args));
            } else if ((event as { once?: boolean }).once) {
                this.once(event.name, (...args: unknown[]) => event.execute(this, ...args));
            } else {
                this.on(event.name, (...args: unknown[]) => event.execute(this, ...args));
            }
        }
    }

    setupIntl(): void {
        this.localeCache = FormatJS.createIntlCache();

        // Load english intl
        this.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);

        // Load bot intl
        this.checkLocaleIntlLoad(config.general.language);
    }

    createIntlForLocale(locale: string): ReturnType<typeof FormatJS.createIntl> {
        const messages = loadJsonResourceSync<Record<string, string>>(`languages/${locale}.json`);

        const intlConfig = {
            locale,
            messages,
            defaultLocale: Constants.DEFAULT_LOCALE,
        };

        return FormatJS.createIntl(intlConfig, this.localeCache);
    }

    checkLocaleIntlLoad(locale: string): void {
        if (!this.intlInstances[locale]) {
            this.intlInstances[locale] = this.createIntlForLocale(locale);
        }
    }

    intlGet(guildId: string | null, key: string, options: Record<string, unknown> = {}): string {
        let locale = Constants.DEFAULT_LOCALE;

        if (guildId !== null) {
            const instance = this.getInstance(guildId);
            locale = (instance as { generalSettings: { language: string } }).generalSettings.language;
        }

        this.checkLocaleIntlLoad(locale);

        let message = '';
        try {
            message = (this.intlInstances[locale] as { formatMessage: (descriptor: { id: string }, values?: Record<string, unknown>) => string }).formatMessage(
                { id: key },
                options,
            );
        } catch (_e) {
            /* Fallback to default locale */
            this.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);
            message = (this.intlInstances[Constants.DEFAULT_LOCALE] as { formatMessage: (descriptor: { id: string }, values?: Record<string, unknown>) => string }).formatMessage(
                { id: key },
                options,
            );
        }

        return message;
    }

    getInstance(guildId: string): unknown {
        return this.instances[guildId];
    }

    setInstance(guildId: string, instance: unknown): void {
        this.instances[guildId] = instance;
    }

    readGeneralSettingsTemplate(): Record<string, unknown> {
        return loadJsonResourceSync('templates/generalSettings.json');
    }

    readNotificationSettingsTemplate(): Record<string, unknown> {
        return loadJsonResourceSync('templates/notificationSettings.json');
    }

    log(title: string, message: string, level: string): void {
        this.logger.log(title, message, level);
    }

    build(): void {
        /* Build implementation */
    }
}
