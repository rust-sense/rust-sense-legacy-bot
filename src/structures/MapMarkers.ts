import * as Constants from '../util/constants.js';
import * as GameMap from '../util/GameMap.js';
import * as Timer from '../util/timer.js';

interface Marker {
    id: number;
    type: number;
    x: number;
    y: number;
}

interface MapMarkersData {
    markers: Marker[];
}

interface RustplusLike {
    guildId: string;
    serverId: string;
    log: (title: string, message: string, level: string) => void;
    intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string;
}

interface ClientLike {
    getInstance: (guildId: string) => { serverList: Record<string, unknown> };
}

export default class MapMarkers {
    private _markers: Marker[];
    private _rustplus: RustplusLike;
    private _client: ClientLike;
    private _types = {
        Player: 1,
        Explosion: 2,
        VendingMachine: 3,
        CH47: 4,
        CargoShip: 5,
        Crate: 6,
        GenericRadius: 7,
        PatrolHelicopter: 8,
        TravelingVendor: 9,
    };

    private _players: Marker[] = [];
    private _vendingMachines: Marker[] = [];
    private _ch47s: Marker[] = [];
    private _cargoShips: Marker[] = [];
    private _genericRadiuses: Marker[] = [];
    private _patrolHelicopters: Marker[] = [];
    private _travelingVendors: Marker[] = [];
    private _deepSeas: Marker[] = [];

    /* Timers */
    cargoShipEgressTimers: Record<number, Timer.Timer> = {};
    crateSmallOilRigTimer: Timer.Timer | null = null;
    crateLargeOilRigTimer: Timer.Timer | null = null;
    deepSeaTimer: Timer.Timer | null = null;

    /* Event dates */
    timeSinceCargoShipWasOut: Date | null = null;
    timeSinceCH47WasOut: Date | null = null;
    timeSinceSmallOilRigWasTriggered: Date | null = null;
    timeSinceLargeOilRigWasTriggered: Date | null = null;
    timeSincePatrolHelicopterWasOnMap: Date | null = null;
    timeSincePatrolHelicopterWasDestroyed: Date | null = null;
    timeSinceTravelingVendorWasOnMap: Date | null = null;
    timeSinceDeepSeaSpawned: Date | null = null;
    timeSinceDeepSeaWasOnMap: Date | null = null;

    /* Event location */
    patrolHelicopterDestroyedLocation: string | null = null;

    /* Vending Machine variables */
    knownVendingMachines: Marker[] = [];

    /* DeepSea. */
    isDeepSeaActive = false;

    constructor(mapMarkers: MapMarkersData, rustplus: RustplusLike, client: ClientLike) {
        this._markers = mapMarkers.markers;
        this._rustplus = rustplus;
        this._client = client;

        this.updateMapMarkers(mapMarkers);
    }

    get markers(): Marker[] {
        return this._markers;
    }
    set markers(markers: Marker[]) {
        this._markers = markers;
    }
    get rustplus(): RustplusLike {
        return this._rustplus;
    }
    set rustplus(rustplus: RustplusLike) {
        this._rustplus = rustplus;
    }
    get client(): ClientLike {
        return this._client;
    }
    set client(client: ClientLike) {
        this._client = client;
    }
    get types(): typeof this._types {
        return this._types;
    }
    get players(): Marker[] {
        return this._players;
    }
    set players(players: Marker[]) {
        this._players = players;
    }
    get vendingMachines(): Marker[] {
        return this._vendingMachines;
    }
    set vendingMachines(vendingMachines: Marker[]) {
        this._vendingMachines = vendingMachines;
    }
    get ch47s(): Marker[] {
        return this._ch47s;
    }
    set ch47s(ch47s: Marker[]) {
        this._ch47s = ch47s;
    }
    get cargoShips(): Marker[] {
        return this._cargoShips;
    }
    set cargoShips(cargoShips: Marker[]) {
        this._cargoShips = cargoShips;
    }
    get genericRadiuses(): Marker[] {
        return this._genericRadiuses;
    }
    set genericRadiuses(genericRadiuses: Marker[]) {
        this._genericRadiuses = genericRadiuses;
    }
    get patrolHelicopters(): Marker[] {
        return this._patrolHelicopters;
    }
    set patrolHelicopters(patrolHelicopters: Marker[]) {
        this._patrolHelicopters = patrolHelicopters;
    }
    get travelingVendors(): Marker[] {
        return this._travelingVendors;
    }
    set travelingVendors(travelingVendors: Marker[]) {
        this._travelingVendors = travelingVendors;
    }
    get deepSeas(): Marker[] {
        return this._deepSeas;
    }
    set deepSeas(deepSeas: Marker[]) {
        this._deepSeas = deepSeas;
    }

    getMarkerByTypeId(type: number, id: number): Marker | undefined {
        return this.markers.find((marker) => marker.type === type && marker.id === id);
    }

    updateMapMarkers(mapMarkers: MapMarkersData): void {
        this.markers = mapMarkers.markers;

        this.players = this.markers.filter((marker) => marker.type === this.types.Player);
        this.vendingMachines = this.markers.filter((marker) => marker.type === this.types.VendingMachine);
        this.ch47s = this.markers.filter((marker) => marker.type === this.types.CH47);
        this.cargoShips = this.markers.filter((marker) => marker.type === this.types.CargoShip);
        this.genericRadiuses = this.markers.filter((marker) => marker.type === this.types.GenericRadius);
        this.patrolHelicopters = this.markers.filter((marker) => marker.type === this.types.PatrolHelicopter);
        this.travelingVendors = this.markers.filter((marker) => marker.type === this.types.TravelingVendor);
    }
}
