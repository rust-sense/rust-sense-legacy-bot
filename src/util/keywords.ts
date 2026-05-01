export function getListOfCommandKeywords(
    client: { intlGet: (guildId: string | null, key: string) => string },
    guildId: string,
): string[] {
    return [
        client.intlGet(guildId, 'commandSyntaxAfk'),
        client.intlGet(guildId, 'commandSyntaxAlive'),
        client.intlGet(guildId, 'commandSyntaxCargo'),
        client.intlGet(guildId, 'commandSyntaxChinook'),
        client.intlGet(guildId, 'commandSyntaxConnection'),
        client.intlGet(guildId, 'commandSyntaxConnections'),
        client.intlGet(guildId, 'commandSyntaxCraft'),
        client.intlGet(guildId, 'commandSyntaxDeath'),
        client.intlGet(guildId, 'commandSyntaxDeaths'),
        client.intlGet(guildId, 'commandSyntaxDecay'),
        client.intlGet(guildId, 'commandSyntaxDeepSea'),
        client.intlGet(guildId, 'commandSyntaxEvents'),
        client.intlGet(guildId, 'commandSyntaxHeli'),
        client.intlGet(guildId, 'commandSyntaxLarge'),
        client.intlGet(guildId, 'commandSyntaxLeader'),
        client.intlGet(guildId, 'commandSyntaxMarker'),
        client.intlGet(guildId, 'commandSyntaxMarkers'),
        client.intlGet(guildId, 'commandSyntaxMarket'),
        client.intlGet(guildId, 'commandSyntaxMute'),
        client.intlGet(guildId, 'commandSyntaxNote'),
        client.intlGet(guildId, 'commandSyntaxNotes'),
        client.intlGet(guildId, 'commandSyntaxOffline'),
        client.intlGet(guildId, 'commandSyntaxOnline'),
        client.intlGet(guildId, 'commandSyntaxPlayer'),
        client.intlGet(guildId, 'commandSyntaxPlayers'),
        client.intlGet(guildId, 'commandSyntaxPop'),
        client.intlGet(guildId, 'commandSyntaxProx'),
        client.intlGet(guildId, 'commandSyntaxRecycle'),
        client.intlGet(guildId, 'commandSyntaxResearch'),
        client.intlGet(guildId, 'commandSyntaxSend'),
        client.intlGet(guildId, 'commandSyntaxSmall'),
        client.intlGet(guildId, 'commandSyntaxStack'),
        client.intlGet(guildId, 'commandSyntaxSteamid'),
        client.intlGet(guildId, 'commandSyntaxTeam'),
        client.intlGet(guildId, 'commandSyntaxTime'),
        client.intlGet(guildId, 'commandSyntaxTimer'),
        client.intlGet(guildId, 'commandSyntaxTimers'),
        client.intlGet(guildId, 'commandSyntaxTranslateTo'),
        client.intlGet(guildId, 'commandSyntaxTranslateFromTo'),
        client.intlGet(guildId, 'commandSyntaxTTS'),
        client.intlGet(guildId, 'commandSyntaxUnmute'),
        client.intlGet(guildId, 'commandSyntaxUpkeep'),
        client.intlGet(guildId, 'commandSyntaxUptime'),
        client.intlGet(guildId, 'commandSyntaxWipe'),
        client.intlGet('en', 'commandSyntaxAfk'),
        client.intlGet('en', 'commandSyntaxAlive'),
        client.intlGet('en', 'commandSyntaxCargo'),
        client.intlGet('en', 'commandSyntaxChinook'),
        client.intlGet('en', 'commandSyntaxConnection'),
        client.intlGet('en', 'commandSyntaxConnections'),
        client.intlGet('en', 'commandSyntaxCraft'),
        client.intlGet('en', 'commandSyntaxDeath'),
        client.intlGet('en', 'commandSyntaxDeaths'),
        client.intlGet('en', 'commandSyntaxDecay'),
        client.intlGet('en', 'commandSyntaxDeepSea'),
        client.intlGet('en', 'commandSyntaxEvents'),
        client.intlGet('en', 'commandSyntaxHeli'),
        client.intlGet('en', 'commandSyntaxLarge'),
        client.intlGet('en', 'commandSyntaxLeader'),
        client.intlGet('en', 'commandSyntaxMarker'),
        client.intlGet('en', 'commandSyntaxMarkers'),
        client.intlGet('en', 'commandSyntaxMarket'),
        client.intlGet('en', 'commandSyntaxMute'),
        client.intlGet('en', 'commandSyntaxNote'),
        client.intlGet('en', 'commandSyntaxNotes'),
        client.intlGet('en', 'commandSyntaxOffline'),
        client.intlGet('en', 'commandSyntaxOnline'),
        client.intlGet('en', 'commandSyntaxPlayer'),
        client.intlGet('en', 'commandSyntaxPlayers'),
        client.intlGet('en', 'commandSyntaxPop'),
        client.intlGet('en', 'commandSyntaxProx'),
        client.intlGet('en', 'commandSyntaxRecycle'),
        client.intlGet('en', 'commandSyntaxResearch'),
        client.intlGet('en', 'commandSyntaxSend'),
        client.intlGet('en', 'commandSyntaxSmall'),
        client.intlGet('en', 'commandSyntaxStack'),
        client.intlGet('en', 'commandSyntaxSteamid'),
        client.intlGet('en', 'commandSyntaxTeam'),
        client.intlGet('en', 'commandSyntaxTime'),
        client.intlGet('en', 'commandSyntaxTimer'),
        client.intlGet('en', 'commandSyntaxTimers'),
        client.intlGet('en', 'commandSyntaxTranslateTo'),
        client.intlGet('en', 'commandSyntaxTranslateFromTo'),
        client.intlGet('en', 'commandSyntaxTTS'),
        client.intlGet('en', 'commandSyntaxUnmute'),
        client.intlGet('en', 'commandSyntaxUpkeep'),
        client.intlGet('en', 'commandSyntaxUptime'),
        client.intlGet('en', 'commandSyntaxWipe'),
    ];
}

export function getListOfUsedKeywords(
    client: {
        intlGet: (guildId: string | null, key: string) => string;
        getInstance: (guildId: string) => {
            serverList: Record<
                string,
                {
                    alarms: Record<number, unknown>;
                    switches: Record<number, unknown>;
                    switchGroups: Record<number, unknown>;
                }
            >;
        };
    },
    guildId: string,
    serverId: string,
): string[] {
    const instance = client.getInstance(guildId);

    let list = [...getListOfCommandKeywords(client, guildId)];
    const server = instance.serverList[serverId];
    if (!server) return list;
    for (const [_id, _value] of Object.entries(server.alarms)) {
        list.push((_value as { name: string }).name);
    }
    for (const [_id, _value] of Object.entries(server.switches)) {
        list.push((_value as { name: string }).name);
    }
    for (const [_id, _value] of Object.entries(server.switchGroups)) {
        list.push((_value as { name: string }).name);
    }
    return list;
}
