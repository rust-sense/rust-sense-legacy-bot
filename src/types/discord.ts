import type { Client, Guild, Role, TextChannel, VoiceChannel } from 'discord.js';
import type { Instance, Server } from './instance.js';

export interface DiscordBot extends Client {
    commands: Map<string, unknown>;
    fcmListeners: Record<string, { destroy: () => void }>;
    fcmListenersLite: Record<string, Record<string, { destroy: () => void }>>;
    instances: Record<string, Instance>;
    intlInstances: Record<string, unknown>;
    customGuildIntl: Record<string, unknown>;
    rustplusInstances: Record<string, unknown>;
    activeRustplusInstances: Record<string, unknown>;
    rustplusReconnectTimers: Record<string, unknown>;
    rustplusLiteReconnectTimers: Record<string, unknown>;
    rustplusReconnecting: Record<string, boolean>;
    rustplusMaps: Record<string, unknown>;
    uptimeBot: Date | null;
    items: unknown;
    rustlabs: unknown;
    cctv: unknown;
    logger: unknown;

    getInstance(guildId: string): Instance;
    setInstance(guildId: string, instance: Instance): void;
    readGeneralSettingsTemplate(): Record<string, unknown>;
    readNotificationSettingsTemplate(): Record<string, unknown>;
    intlGet(guildId: string | null, key: string, options?: Record<string, unknown>): string;
    log(title: string, message: string, level: string): void;
    build(): void;
}

export interface DiscordCommand {
    name: string;
    description?: string;
    execute: (...args: any[]) => Promise<void> | void;
}

export interface DiscordEvent {
    name: string;
    execute: (...args: any[]) => Promise<void> | void;
}

export interface RustplusEvent {
    name: string;
    execute: (...args: any[]) => Promise<void> | void;
}
