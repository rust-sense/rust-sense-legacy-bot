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
    guildId: string;
    serverId: string;
    log: (title: string, message: string, level: string) => void;
    intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string;
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
        this.leaderSteamId = team.leaderSteamId.toString();

        for (const player of team.members) {
            const existingPlayer = this.getPlayer(player.steamId.toString());
            if (existingPlayer) {
                existingPlayer.updatePlayer(player as ConstructorParameters<typeof Player>[0]);
            } else {
                this.players.push(new Player(player as ConstructorParameters<typeof Player>[0], this.rustplus));
            }
        }

        /* Remove players that are no longer in the team */
        this.players = this.players.filter((player) =>
            team.members.some((member) => member.steamId.toString() === player.steamId),
        );

        this.teamSize = this.players.length;
        this.allOnline = this.players.every((player) => player.isOnline);
        this.allOffline = this.players.every((player) => !player.isOnline);
    }

    getPlayer(steamId: string): Player | undefined {
        return this.players.find((player) => player.steamId === steamId);
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
}
