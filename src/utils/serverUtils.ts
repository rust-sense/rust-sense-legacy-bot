export function serverIdToConnectString(serverId: string): string {
    const lastDash = serverId.lastIndexOf('-');
    return `connect ${serverId.slice(0, lastDash)}:${serverId.slice(lastDash + 1)}`;
}
