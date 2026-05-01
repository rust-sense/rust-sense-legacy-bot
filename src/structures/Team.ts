import { client } from '../index.js';
import Player from './Player.js';

interface TeamData {
    leaderSteamId: string | number;
    members: Array<{
        steamId: string | number;
        name: string;
        x: number;
        y: number;
        isOnline: boolean;
        spawnTime: number;
        isAlive: boolean;
        deathTime: number;
    }>;
}

interface RustplusLike {
    info: { mapSize: number };
    guildId: string;
    serverId: string;
    log: (title: string, message: string, level: string) => void;
    intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string;
    promoteToLeaderAsync: (steamId: string) => Promise<unknown>;
}

export default class Team {
    private _leaderSteamId: string;
    private _players: Player[];
    private _teamSize: number;
    private _rustplus: RustplusLike;
    private _allOnline = false;
    private _allOffline = false;

    constructor(team: TeamData, rustplus: RustplusLike) {
        this._leaderSteamId = team.leaderSteamId.toString();
        this._players = [];
        this._teamSize = this.players.length;

        this._rustplus = rustplus;

        this.updateTeam(team);
    }

    /* Getters and Setters */
    get leaderSteamId(): string {
        return this._leaderSteamId;
    }
    set leaderSteamId(steamId: string) {
        this._leaderSteamId = steamId;
    }
    get players(): Player[] {
        return this._players;
    }
    set players(players: Player[]) {
        this._players = players;
    }
    get teamSize(): number {
        return this._teamSize;
    }
    set teamSize(teamSize: number) {
        this._teamSize = teamSize;
    }
    get rustplus(): RustplusLike {
        return this._rustplus;
    }
    set rustplus(rustplus: RustplusLike) {
        this._rustplus = rustplus;
    }
    get allOnline(): boolean {
        return this._allOnline;
    }
    set allOnline(allOnline: boolean) {
        this._allOnline = allOnline;
    }
    get allOffline(): boolean {
        return this._allOffline;
    }
    set allOffline(allOffline: boolean) {
        this._allOffline = allOffline;
    }

    updateTeam(team: TeamData): void {
        const instance = client.getInstance(this.rustplus.guildId);

        if (this.isLeaderSteamIdChanged(team)) {
            let player = this.getPlayer(this.leaderSteamId);
            if (player !== null) player.teamLeader = false;

            player = this.getPlayer(team.leaderSteamId.toString());
            if (player !== null) {
                this.rustplus.log(
                    client.intlGet(null, 'commandCap'),
                    client.intlGet(null, 'leaderTransferred', { name: `${player.name}:${player.steamId}` }),
                    'info',
                );
            }
        }

        this.leaderSteamId = team.leaderSteamId.toString();

        let unhandled = this.players.slice();
        for (const member of team.members) {
            const steamId = member.steamId.toString();
            if (this.players.some((p) => p.steamId === steamId)) {
                this.getPlayer(steamId)!.updatePlayer(member as ConstructorParameters<typeof Player>[0]);
                unhandled = unhandled.filter((p) => p.steamId !== steamId);
            } else {
                this.addPlayer(member);
            }

            if (!Object.hasOwn(instance.teamChatColors, steamId)) {
                const letters = '0123456789ABCDEF';
                let color = '#';
                for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
                instance.teamChatColors[steamId] = color;
            }
        }

        for (const player of unhandled) {
            this.removePlayer(player);
        }

        this.allOnline = true;
        this.allOffline = true;
        for (const player of this.players) {
            this.allOnline = this.allOnline && player.isOnline;
            this.allOffline = this.allOffline && !player.isOnline;
        }

        this.teamSize = this.players.length;

        const leader = this.getPlayer(this.leaderSteamId);
        if (leader !== null) leader.teamLeader = true;

        client.setInstance(this.rustplus.guildId, instance);
    }

    addPlayer(player: ConstructorParameters<typeof Player>[0]): void {
        if (!this.players.some((p) => p.steamId === player.steamId.toString())) {
            this.players.push(new Player(player, this.rustplus));
        }
    }

    removePlayer(player: { steamId: string }): void {
        this.players = this.players.filter((p) => p.steamId !== player.steamId);
    }

    getPlayer(steamId: string): Player | null {
        return this.players.find((p) => p.steamId === steamId) ?? null;
    }

    getOnlinePlayers(): Player[] {
        return this.players.filter((player) => player.isOnline);
    }

    getOfflinePlayers(): Player[] {
        return this.players.filter((player) => !player.isOnline);
    }

    getAlivePlayers(): Player[] {
        return this.players.filter((player) => player.isAlive);
    }

    getDeadPlayers(): Player[] {
        return this.players.filter((player) => !player.isAlive);
    }

    isPlayerInTeam(steamId: string): boolean {
        return this.getPlayer(steamId) !== null;
    }

    isLeaderSteamIdChanged(team: TeamData): boolean {
        return this.leaderSteamId !== team.leaderSteamId.toString();
    }

    getNewPlayers(team: TeamData): string[] {
        return team.members
            .filter((member) => !this.isPlayerInTeam(member.steamId.toString()))
            .map((member) => member.steamId.toString());
    }

    getLeftPlayers(team: TeamData): string[] {
        const newSteamIds = new Set(team.members.map((m) => m.steamId.toString()));
        return this.players.map((p) => p.steamId).filter((id) => !newSteamIds.has(id));
    }

    getPlayerLongestAlive(): Player {
        return this.players.reduce((prev, curr) => (prev.getAliveSeconds() > curr.getAliveSeconds() ? prev : curr));
    }

    async changeLeadership(steamId: string): Promise<void> {
        const player = this.getPlayer(steamId);
        if (player !== null) await player.assignLeader();
    }
}
