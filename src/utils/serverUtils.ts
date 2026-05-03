export function serverIdToConnectString(serverId: string): string {
    const lastDash = serverId.lastIndexOf('-');
    return `connect ${serverId.slice(0, lastDash)}:${serverId.slice(lastDash + 1)}`;
}

export function getServerRustMapsUrl(client: any, server: { battlemetricsId?: string | null }): string | null {
    if (!server.battlemetricsId) return null;

    const url = client.battlemetricsInstances[server.battlemetricsId]?.map_url;
    return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null;
}
