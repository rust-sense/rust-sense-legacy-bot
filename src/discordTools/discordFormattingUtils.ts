export function getGridSuffix(location: string | null): string {
    return location !== null ? ` (${location})` : '';
}

export function getActiveStr(client: any, guildId: string, active: boolean): string {
    return active ? client.intlGet(guildId, 'onCap') : client.intlGet(guildId, 'offCap');
}

export function orEmpty(client: any, guildId: string, value: string): string {
    return value === '' ? client.intlGet(guildId, 'empty') : value;
}
