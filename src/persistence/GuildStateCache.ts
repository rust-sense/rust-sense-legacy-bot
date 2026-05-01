import type { Credentials, Instance } from '../types/instance.js';
import type { PersistenceAdapter } from './types.js';

export class GuildStateCache {
    private instances: Record<string, Instance> = {};
    private credentials: Record<string, Credentials> = {};

    constructor(private readonly adapter: PersistenceAdapter) {}

    listGuildIds(): string[] {
        return this.adapter.listGuildIds();
    }

    hasGuild(guildId: string): boolean {
        return guildId in this.instances || this.adapter.hasGuild(guildId);
    }

    getInstance(guildId: string): Instance {
        if (!(guildId in this.instances)) {
            this.instances[guildId] = this.adapter.readInstance(guildId);
        }

        return this.instances[guildId];
    }

    setInstance(guildId: string, instance: Instance): void {
        this.instances[guildId] = instance;
        this.adapter.writeInstance(guildId, instance);
    }

    getCredentials(guildId: string): Credentials {
        if (!(guildId in this.credentials)) {
            this.credentials[guildId] = this.adapter.readCredentials(guildId);
        }

        return this.credentials[guildId];
    }

    setCredentials(guildId: string, credentials: Credentials): void {
        this.credentials[guildId] = credentials;
        this.adapter.writeCredentials(guildId, credentials);
    }

    deleteGuild(guildId: string): void {
        delete this.instances[guildId];
        delete this.credentials[guildId];
        this.adapter.deleteGuild(guildId);
    }

    flush(): Promise<void> {
        return this.adapter.flush();
    }
}
