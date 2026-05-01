import type { Credentials, Instance } from '../types/instance.js';

export type PersistenceAdapterName = 'json' | 'sqlite' | 'postgres';

export interface PersistenceAdapter {
    readonly name: PersistenceAdapterName;
    readonly deprecated?: boolean;

    init(): Promise<void>;
    close(): Promise<void>;
    listGuildIds(): string[];
    hasGuild(guildId: string): boolean;
    readInstance(guildId: string): Instance;
    writeInstance(guildId: string, instance: Instance): void;
    deleteGuild(guildId: string): void;
    readCredentials(guildId: string): Credentials;
    writeCredentials(guildId: string, credentials: Credentials): void;
    flush(): Promise<void>;
}

export interface PersistenceConfig {
    adapter: PersistenceAdapterName;
    sqlitePath: string;
    postgresUrl: string | null;
    migrateLegacyJson: boolean;
}
