import * as Constants from '../util/constants.js';
import * as GameMap from '../util/GameMap.js';
import * as Timer from '../util/timer.js';

interface Monument {
    token?: string;
    x: number;
    y: number;
}

interface Marker {
    id: number;
    type: number;
    x: number;
    y: number;
    name?: string;
    sellOrders?: unknown;
    rotation?: number;
    radius?: number;
    /* Extended fields set during tracking */
    location?: ReturnType<typeof GameMap.getPos>;
    ch47Type?: 'smallOilRig' | 'largeOilRig' | 'crate';
    onItsWayOut?: boolean;
    isDocked?: boolean;
    isHalted?: boolean;
}

interface MapMarkersData {
    markers: Marker[];
}

interface InfoLike {
    correctedMapSize: number;
}

interface MapLike {
    monuments: Monument[];
    monumentInfo: Record<string, { clean: string; radius: number }>;
}

interface RustplusLike {
    guildId: string;
    serverId: string;
    info: InfoLike | null;
    map: MapLike;
    isFirstPoll: boolean;
    isNewConnection: boolean;
    persistentRuntimeStateRestored?: boolean;
    notificationSettings: Record<string, unknown>;
    cargoShipTracers: Record<string | number, Array<{ x: number; y: number }>>;
    patrolHelicopterTracers: Record<string | number, Array<{ x: number; y: number }>>;
    log: (title: string, message: string, level?: string) => void;
    sendEvent: (
        setting: unknown,
        msg: string,
        type?: string | null,
        color?: string,
        isFirstPoll?: boolean,
        image?: string,
    ) => void;
    persistMapMarkersRuntimeState?: () => void;
}

interface ClientLike {
    getInstance: (guildId: string) => {
        serverList: Record<string, { oilRigLockedCrateUnlockTimeMs: number; cargoShipEgressTimeMs: number }>;
        marketBlacklist: string[];
    };
    intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string;
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
    crateSmallOilRigLocation: string | null = null;
    crateLargeOilRigTimer: Timer.Timer | null = null;
    crateLargeOilRigLocation: string | null = null;
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
    knownVendingMachines: Array<{ x: number; y: number }> = [];

    /* DeepSea */
    isDeepSeaActive = false;

    /* Used by getClosestMonument */
    validCrateMonuments: string[] = [];

    /* Used by reset() */
    subscribedItemsId: string[] = [];
    foundItems: unknown[] = [];

    constructor(mapMarkers: MapMarkersData, rustplus: RustplusLike, client: ClientLike) {
        this._markers = mapMarkers.markers;
        this._rustplus = rustplus;
        this._client = client;
        this.updateMapMarkers(mapMarkers);
    }

    get markers(): Marker[] {
        return this._markers;
    }
    set markers(v: Marker[]) {
        this._markers = v;
    }
    get rustplus(): RustplusLike {
        return this._rustplus;
    }
    set rustplus(v: RustplusLike) {
        this._rustplus = v;
    }
    get client(): ClientLike {
        return this._client;
    }
    set client(v: ClientLike) {
        this._client = v;
    }
    get types(): typeof this._types {
        return this._types;
    }
    get players(): Marker[] {
        return this._players;
    }
    set players(v: Marker[]) {
        this._players = v;
    }
    get vendingMachines(): Marker[] {
        return this._vendingMachines;
    }
    set vendingMachines(v: Marker[]) {
        this._vendingMachines = v;
    }
    get ch47s(): Marker[] {
        return this._ch47s;
    }
    set ch47s(v: Marker[]) {
        this._ch47s = v;
    }
    get cargoShips(): Marker[] {
        return this._cargoShips;
    }
    set cargoShips(v: Marker[]) {
        this._cargoShips = v;
    }
    get genericRadiuses(): Marker[] {
        return this._genericRadiuses;
    }
    set genericRadiuses(v: Marker[]) {
        this._genericRadiuses = v;
    }
    get patrolHelicopters(): Marker[] {
        return this._patrolHelicopters;
    }
    set patrolHelicopters(v: Marker[]) {
        this._patrolHelicopters = v;
    }
    get travelingVendors(): Marker[] {
        return this._travelingVendors;
    }
    set travelingVendors(v: Marker[]) {
        this._travelingVendors = v;
    }
    get deepSeas(): Marker[] {
        return this._deepSeas;
    }
    set deepSeas(v: Marker[]) {
        this._deepSeas = v;
    }

    getType(type: number): Marker[] | null {
        if (!Object.values(this.types).includes(type)) return null;
        switch (type) {
            case this.types.Player:
                return this.players;
            case this.types.VendingMachine:
                return this.vendingMachines;
            case this.types.CH47:
                return this.ch47s;
            case this.types.CargoShip:
                return this.cargoShips;
            case this.types.GenericRadius:
                return this.genericRadiuses;
            case this.types.PatrolHelicopter:
                return this.patrolHelicopters;
            case this.types.TravelingVendor:
                return this.travelingVendors;
            default:
                return null;
        }
    }

    getMarkersOfType(type: number, markers: Marker[]): Marker[] {
        if (!Object.values(this.types).includes(type)) return [];
        return markers.filter((m) => m.type === type);
    }

    getMarkerByTypeId(type: number, id: number): Marker | undefined {
        return this.getType(type)?.find((m) => m.id === id);
    }

    getMarkerByTypeXY(type: number, x: number, y: number): Marker | undefined {
        return this.getType(type)?.find((m) => m.x === x && m.y === y);
    }

    isMarkerPresentByTypeId(type: number, id: number, markers: Marker[] | null = null): boolean {
        if (markers) return markers.some((m) => m.id === id);
        return this.getType(type)?.some((m) => m.id === id) ?? false;
    }

    getNewMarkersOfTypeId(type: number, markers: Marker[]): Marker[] {
        return this.getMarkersOfType(type, markers).filter((m) => !this.isMarkerPresentByTypeId(type, m.id));
    }

    getLeftMarkersOfTypeId(type: number, markers: Marker[]): Marker[] {
        let left = (this.getType(type) ?? []).slice();
        for (const m of this.getMarkersOfType(type, markers)) {
            if (this.isMarkerPresentByTypeId(type, m.id)) {
                left = left.filter((e) => e.id !== m.id);
            }
        }
        return left;
    }

    getRemainingMarkersOfTypeId(type: number, markers: Marker[]): Marker[] {
        return markers.filter((m) => this.isMarkerPresentByTypeId(type, m.id));
    }

    isMarkerPresentByTypeXY(type: number, x: number, y: number, markers: Marker[] | null = null): boolean {
        if (markers) return markers.some((m) => m.x === x && m.y === y);
        return this.getType(type)?.some((m) => m.x === x && m.y === y) ?? false;
    }

    getNewMarkersOfTypeXY(type: number, markers: Marker[]): Marker[] {
        return this.getMarkersOfType(type, markers).filter((m) => !this.isMarkerPresentByTypeXY(type, m.x, m.y));
    }

    getLeftMarkersOfTypeXY(type: number, markers: Marker[]): Marker[] {
        let left = (this.getType(type) ?? []).slice();
        for (const m of this.getMarkersOfType(type, markers)) {
            if (this.isMarkerPresentByTypeXY(type, m.x, m.y)) {
                left = left.filter((e) => e.x !== m.x || e.y !== m.y);
            }
        }
        return left;
    }

    getRemainingMarkersOfTypeXY(type: number, markers: Marker[]): Marker[] {
        return markers.filter((m) => this.isMarkerPresentByTypeXY(type, m.x, m.y));
    }

    isVendingMachineBlacklisted(marker: Marker): boolean {
        if (marker.type !== this.types.VendingMachine) return false;
        const instance = this.client.getInstance(this.rustplus.guildId);
        return instance.marketBlacklist.some((b) => marker.name?.toLowerCase().includes(b.toLowerCase()));
    }

    updateMapMarkers(mapMarkers: MapMarkersData): void {
        this.updatePlayers(mapMarkers);
        this.updateCargoShips(mapMarkers);
        this.updatePatrolHelicopters(mapMarkers);
        this.updateCH47s(mapMarkers);
        this.updateVendingMachines(mapMarkers);
        this.updateGenericRadiuses(mapMarkers);
        this.updateTravelingVendors(mapMarkers);

        if (
            this.rustplus?.persistentRuntimeStateRestored &&
            typeof this.rustplus.persistMapMarkersRuntimeState === 'function'
        ) {
            this.rustplus.persistMapMarkersRuntimeState();
        }
    }

    updatePlayers(mapMarkers: MapMarkersData): void {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        const mapSize = this.rustplus.info!.correctedMapSize;

        for (const marker of newMarkers) {
            marker.location = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            this.players.push(marker);
        }

        for (const marker of leftMarkers) {
            this.players = this.players.filter((e) => e.id !== marker.id);
        }

        for (const marker of remainingMarkers) {
            const player = this.getMarkerByTypeId(this.types.Player, marker.id)!;
            player.x = marker.x;
            player.y = marker.y;
            player.location = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
        }
    }

    updateVendingMachines(mapMarkers: MapMarkersData): void {
        const newMarkers = this.getNewMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        const mapSize = this.rustplus.info!.correctedMapSize;

        for (const marker of newMarkers) {
            const pos = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            marker.location = pos;

            if (!this.rustplus.isFirstPoll && !this.isVendingMachineBlacklisted(marker)) {
                if (!this.knownVendingMachines.some((e) => e.x === marker.x && e.y === marker.y)) {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.vendingMachineDetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'newVendingMachine', { location: pos.string }),
                        null,
                        Constants.COLOR_NEW_VENDING_MACHINE,
                    );
                }
            }

            this.knownVendingMachines.push({ x: marker.x, y: marker.y });
            this.vendingMachines.push(marker);
        }

        for (const marker of leftMarkers) {
            this.vendingMachines = this.vendingMachines.filter((e) => e.x !== marker.x || e.y !== marker.y);
        }

        for (const marker of remainingMarkers) {
            const vm = this.getMarkerByTypeXY(this.types.VendingMachine, marker.x, marker.y)!;
            vm.id = marker.id;
            vm.location = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            vm.sellOrders = marker.sellOrders;
        }

        const deepSeaMarkers = this.vendingMachines.filter((marker) =>
            GameMap.isOutsideGridSystem(marker.x, marker.y, mapSize, 4 * GameMap.gridDiameter),
        );

        if (deepSeaMarkers.length > 0) {
            if (!this.isDeepSeaActive) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.deepSeaDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'deepSeaDetected'),
                    'deepSea',
                    Constants.COLOR_DEEP_SEA_DETECTED,
                );
                if (this.timeSinceDeepSeaSpawned === null) this.timeSinceDeepSeaSpawned = new Date();
                this.timeSinceDeepSeaWasOnMap = null;
                this.isDeepSeaActive = true;
            }
            this.deepSeas = deepSeaMarkers.slice();
        } else {
            if (this.isDeepSeaActive) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.deepSeaLeftMapSetting,
                    this.client.intlGet(this.rustplus.guildId, 'deepSeaLeftMap'),
                    'deepSea',
                    Constants.COLOR_DEEP_SEA_LEFT_MAP,
                );
                this.isDeepSeaActive = false;
                this.timeSinceDeepSeaWasOnMap = new Date();
                this.timeSinceDeepSeaSpawned = null;
            }
            this.deepSeas = [];
        }
    }

    updateCH47s(mapMarkers: MapMarkersData): void {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        const mapSize = this.rustplus.info!.correctedMapSize;

        for (const marker of newMarkers) {
            const pos = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            marker.location = pos;

            const smallOilRig: Array<{ x: number; y: number }> = [];
            const largeOilRig: Array<{ x: number; y: number }> = [];
            for (const monument of this.rustplus.map.monuments) {
                if (monument.token === 'oil_rig_small') smallOilRig.push({ x: monument.x, y: monument.y });
                else if (monument.token === 'large_oil_rig') largeOilRig.push({ x: monument.x, y: monument.y });
            }

            let found = false;
            if (!this.rustplus.isFirstPoll) {
                for (const oilRig of smallOilRig) {
                    if (
                        GameMap.getDistance(marker.x, marker.y, oilRig.x, oilRig.y) <=
                        Constants.OIL_RIG_CHINOOK_47_MAX_SPAWN_DISTANCE
                    ) {
                        found = true;
                        const oilRigLocation = GameMap.getPos(oilRig.x, oilRig.y, mapSize, this.rustplus);
                        marker.ch47Type = 'smallOilRig';

                        this.rustplus.sendEvent(
                            this.rustplus.notificationSettings.heavyScientistCalledSetting,
                            this.client.intlGet(this.rustplus.guildId, 'heavyScientistsCalledSmall', {
                                location: oilRigLocation.location,
                            }),
                            'small',
                            Constants.COLOR_HEAVY_SCIENTISTS_CALLED_SMALL,
                            this.rustplus.isFirstPoll,
                            'small_oil_rig_logo.png',
                        );

                        if (this.crateSmallOilRigTimer) this.crateSmallOilRigTimer.stop();

                        const instance = this.client.getInstance(this.rustplus.guildId);
                        this.crateSmallOilRigTimer = new Timer.Timer(
                            this.notifyCrateSmallOilRigOpen.bind(this),
                            instance.serverList[this.rustplus.serverId].oilRigLockedCrateUnlockTimeMs,
                            [oilRigLocation.location],
                        );
                        this.crateSmallOilRigTimer.start();

                        this.crateSmallOilRigLocation = oilRigLocation.location;
                        this.timeSinceSmallOilRigWasTriggered = new Date();
                        break;
                    }
                }
            }

            if (!found && !this.rustplus.isFirstPoll) {
                for (const oilRig of largeOilRig) {
                    if (
                        GameMap.getDistance(marker.x, marker.y, oilRig.x, oilRig.y) <=
                        Constants.OIL_RIG_CHINOOK_47_MAX_SPAWN_DISTANCE
                    ) {
                        found = true;
                        const oilRigLocation = GameMap.getPos(oilRig.x, oilRig.y, mapSize, this.rustplus);
                        marker.ch47Type = 'largeOilRig';

                        this.rustplus.sendEvent(
                            this.rustplus.notificationSettings.heavyScientistCalledSetting,
                            this.client.intlGet(this.rustplus.guildId, 'heavyScientistsCalledLarge', {
                                location: oilRigLocation.location,
                            }),
                            'large',
                            Constants.COLOR_HEAVY_SCIENTISTS_CALLED_LARGE,
                            this.rustplus.isFirstPoll,
                            'large_oil_rig_logo.png',
                        );

                        if (this.crateLargeOilRigTimer) this.crateLargeOilRigTimer.stop();

                        const instance = this.client.getInstance(this.rustplus.guildId);
                        this.crateLargeOilRigTimer = new Timer.Timer(
                            this.notifyCrateLargeOilRigOpen.bind(this),
                            instance.serverList[this.rustplus.serverId].oilRigLockedCrateUnlockTimeMs,
                            [oilRigLocation.location],
                        );
                        this.crateLargeOilRigTimer.start();

                        this.crateLargeOilRigLocation = oilRigLocation.location;
                        this.timeSinceLargeOilRigWasTriggered = new Date();
                        break;
                    }
                }
            }

            if (!found) {
                const offset = 4 * GameMap.gridDiameter;
                if (GameMap.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.chinook47DetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'chinook47EntersMap', { location: pos.string }),
                        'chinook',
                        Constants.COLOR_CHINOOK47_ENTERS_MAP,
                    );
                } else {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.chinook47DetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'chinook47Located', { location: pos.string }),
                        'chinook',
                        Constants.COLOR_CHINOOK47_LOCATED,
                    );
                }
                marker.ch47Type = 'crate';
            }

            this.ch47s.push(marker);
        }

        for (const marker of leftMarkers) {
            if (marker.ch47Type === 'crate') {
                this.timeSinceCH47WasOut = new Date();
                this.rustplus.log(
                    this.client.intlGet(null, 'eventCap'),
                    this.client.intlGet(null, 'chinook47LeftMap', { location: marker.location?.string }),
                );
            }
            this.ch47s = this.ch47s.filter((e) => e.id !== marker.id);
        }

        for (const marker of remainingMarkers) {
            const ch47 = this.getMarkerByTypeId(this.types.CH47, marker.id)!;
            ch47.x = marker.x;
            ch47.y = marker.y;
            ch47.location = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
        }
    }

    updateCargoShips(mapMarkers: MapMarkersData): void {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        const mapSize = this.rustplus.info!.correctedMapSize;

        for (const marker of newMarkers) {
            const pos = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            this.rustplus.cargoShipTracers[marker.id] = [{ x: marker.x, y: marker.y }];
            marker.location = pos;
            marker.onItsWayOut = false;
            marker.isDocked = false;

            const offset = 4 * GameMap.gridDiameter;
            if (GameMap.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.cargoShipDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'cargoShipEntersMap', { location: pos.string }),
                    'cargo',
                    Constants.COLOR_CARGO_SHIP_ENTERS_MAP,
                );
                const instance = this.client.getInstance(this.rustplus.guildId);
                this.cargoShipEgressTimers[marker.id] = new Timer.Timer(
                    this.notifyCargoShipEgress.bind(this),
                    instance.serverList[this.rustplus.serverId].cargoShipEgressTimeMs,
                    [marker.id],
                );
                this.cargoShipEgressTimers[marker.id].start();
            } else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.cargoShipDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'cargoShipLocated', { location: pos.string }),
                    'cargo',
                    Constants.COLOR_CARGO_SHIP_LOCATED,
                );
            }

            this.cargoShips.push(marker);
        }

        for (const marker of leftMarkers) {
            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.cargoShipLeftSetting,
                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeftMap', { location: marker.location?.string }),
                'cargo',
                Constants.COLOR_CARGO_SHIP_LEFT_MAP,
            );

            if (this.cargoShipEgressTimers[marker.id]) {
                this.cargoShipEgressTimers[marker.id].stop();
                delete this.cargoShipEgressTimers[marker.id];
            }

            this.timeSinceCargoShipWasOut = new Date();
            this.cargoShips = this.cargoShips.filter((e) => e.id !== marker.id);
            delete this.rustplus.cargoShipTracers[marker.id];
        }

        for (const marker of remainingMarkers) {
            const pos = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            const cargoShip = this.getMarkerByTypeId(this.types.CargoShip, marker.id)!;
            this.rustplus.cargoShipTracers[marker.id].push({ x: marker.x, y: marker.y });

            const harbors: Array<{ x: number; y: number }> = [];
            for (const monument of this.rustplus.map.monuments) {
                if (monument.token && /harbor/.test(monument.token)) {
                    harbors.push({ x: monument.x, y: monument.y });
                }
            }

            if (!this.rustplus.isFirstPoll && !cargoShip.isDocked) {
                for (const harbor of harbors) {
                    if (GameMap.getDistance(marker.x, marker.y, harbor.x, harbor.y) <= Constants.HARBOR_DOCK_DISTANCE) {
                        if (marker.x === cargoShip.x && marker.y === cargoShip.y) {
                            const harborLocation = GameMap.getPos(harbor.x, harbor.y, mapSize, this.rustplus);
                            cargoShip.isDocked = true;
                            this.rustplus.sendEvent(
                                this.rustplus.notificationSettings.cargoShipDockingAtHarborSetting,
                                this.client.intlGet(this.rustplus.guildId, 'cargoShipDockingAtHarbor', {
                                    location: harborLocation.location,
                                }),
                                'cargo',
                                Constants.COLOR_CARGO_SHIP_DOCKED,
                            );
                        }
                    }
                }
            } else if (!this.rustplus.isFirstPoll && cargoShip.isDocked) {
                for (const harbor of harbors) {
                    if (GameMap.getDistance(marker.x, marker.y, harbor.x, harbor.y) <= Constants.HARBOR_DOCK_DISTANCE) {
                        if (marker.x !== cargoShip.x || marker.y !== cargoShip.y) {
                            const harborLocation = GameMap.getPos(harbor.x, harbor.y, mapSize, this.rustplus);
                            cargoShip.isDocked = false;
                            this.rustplus.sendEvent(
                                this.rustplus.notificationSettings.cargoShipDockingAtHarborSetting,
                                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeftHarbor', {
                                    location: harborLocation.location,
                                }),
                                'cargo',
                                Constants.COLOR_CARGO_SHIP_DOCKED,
                            );
                        }
                    }
                }
            }

            cargoShip.x = marker.x;
            cargoShip.y = marker.y;
            cargoShip.location = pos;
        }
    }

    updateGenericRadiuses(mapMarkers: MapMarkersData): void {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);

        for (const marker of newMarkers) {
            this.genericRadiuses.push(marker);
        }
        for (const marker of leftMarkers) {
            this.genericRadiuses = this.genericRadiuses.filter((e) => e.id !== marker.id);
        }
        for (const marker of remainingMarkers) {
            const gr = this.getMarkerByTypeId(this.types.GenericRadius, marker.id)!;
            gr.x = marker.x;
            gr.y = marker.y;
        }
    }

    updatePatrolHelicopters(mapMarkers: MapMarkersData): void {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        const mapSize = this.rustplus.info!.correctedMapSize;

        for (const marker of newMarkers) {
            const pos = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            this.rustplus.patrolHelicopterTracers[marker.id] = [{ x: marker.x, y: marker.y }];
            marker.location = pos;

            const offset = 4 * GameMap.gridDiameter;
            if (GameMap.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterEntersMap', { location: pos.string }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_ENTERS_MAP,
                );
            } else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterLocatedAt', { location: pos.string }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_LOCATED_AT,
                );
            }

            this.patrolHelicopters.push(marker);
        }

        for (const marker of leftMarkers) {
            if (GameMap.isOutsideGridSystem(marker.x, marker.y, mapSize)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterLeftSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterLeftMap', {
                        location: marker.location?.string,
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_LEFT_MAP,
                );
                this.timeSincePatrolHelicopterWasOnMap = new Date();
            } else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDestroyedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterTakenDown', {
                        location: marker.location?.string,
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_TAKEN_DOWN,
                );
                this.timeSincePatrolHelicopterWasDestroyed = new Date();
                this.timeSincePatrolHelicopterWasOnMap = new Date();
                this.patrolHelicopterDestroyedLocation = GameMap.getGridPos(marker.x, marker.y, mapSize);
            }

            this.patrolHelicopters = this.patrolHelicopters.filter((e) => e.id !== marker.id);
            delete this.rustplus.patrolHelicopterTracers[marker.id];
        }

        for (const marker of remainingMarkers) {
            const heli = this.getMarkerByTypeId(this.types.PatrolHelicopter, marker.id)!;
            this.rustplus.patrolHelicopterTracers[marker.id].push({ x: marker.x, y: marker.y });
            heli.x = marker.x;
            heli.y = marker.y;
            heli.location = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
        }
    }

    updateTravelingVendors(mapMarkers: MapMarkersData): void {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);
        const mapSize = this.rustplus.info!.correctedMapSize;

        for (const marker of newMarkers) {
            const pos = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            marker.location = pos;
            marker.isHalted = false;

            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.travelingVendorDetectedSetting,
                this.client.intlGet(this.rustplus.guildId, 'travelingVendorSpawnedAt', { location: pos.string }),
                'travelingVendor',
                Constants.COLOR_TRAVELING_VENDOR_LOCATED_AT,
            );
            this.travelingVendors.push(marker);
        }

        for (const marker of leftMarkers) {
            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.travelingVendorLeftSetting,
                this.client.intlGet(this.rustplus.guildId, 'travelingVendorLeftMap', {
                    location: marker.location?.string,
                }),
                'travelingVendor',
                Constants.COLOR_TRAVELING_VENDOR_LEFT_MAP,
            );
            this.timeSinceTravelingVendorWasOnMap = new Date();
            this.travelingVendors = this.travelingVendors.filter((e) => e.id !== marker.id);
        }

        for (const marker of remainingMarkers) {
            const pos = GameMap.getPos(marker.x, marker.y, mapSize, this.rustplus);
            const tv = this.getMarkerByTypeId(this.types.TravelingVendor, marker.id)!;

            if (!this.rustplus.isFirstPoll && !tv.isHalted) {
                if (marker.x === tv.x && marker.y === tv.y) {
                    tv.isHalted = true;
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.travelingVendorHaltedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'travelingVendorHaltedAt', { location: pos.string }),
                        'travelingVendor',
                        Constants.COLOR_TRAVELING_VENDOR_HALTED,
                    );
                }
            } else if (!this.rustplus.isFirstPoll && tv.isHalted) {
                if (marker.x !== tv.x || marker.y !== tv.y) {
                    tv.isHalted = false;
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.travelingVendorHaltedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'travelingVendorResumedAt', {
                            location: pos.string,
                        }),
                        'travelingVendor',
                        Constants.COLOR_TRAVELING_VENDOR_MOVING,
                    );
                }
            }

            tv.x = marker.x;
            tv.y = marker.y;
            tv.location = pos;
        }
    }

    notifyCargoShipEgress(args: unknown[]): void {
        const id = args[0] as number;
        const marker = this.getMarkerByTypeId(this.types.CargoShip, id);
        if (!marker) return;

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.cargoShipEgressSetting,
            this.client.intlGet(this.rustplus.guildId, 'cargoShipEntersEgressStage', {
                location: marker.location?.string,
            }),
            'cargo',
            Constants.COLOR_CARGO_SHIP_ENTERS_EGRESS_STAGE,
        );

        if (this.cargoShipEgressTimers[id]) {
            this.cargoShipEgressTimers[id].stop();
            delete this.cargoShipEgressTimers[id];
        }

        marker.onItsWayOut = true;
    }

    notifyCrateSmallOilRigOpen(args: unknown[]): void {
        const oilRigLocation = args[0] as string;

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.lockedCrateOilRigUnlockedSetting,
            this.client.intlGet(this.rustplus.guildId, 'lockedCrateSmallOilRigUnlocked', { location: oilRigLocation }),
            'small',
            Constants.COLOR_LOCKED_CRATE_SMALL_OILRIG_UNLOCKED,
            this.rustplus.isFirstPoll,
            'locked_crate_small_oil_rig_logo.png',
        );

        this.crateSmallOilRigTimer?.stop();
        this.crateSmallOilRigTimer = null;
        this.crateSmallOilRigLocation = null;
    }

    notifyCrateLargeOilRigOpen(args: unknown[]): void {
        const oilRigLocation = args[0] as string;

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.lockedCrateOilRigUnlockedSetting,
            this.client.intlGet(this.rustplus.guildId, 'lockedCrateLargeOilRigUnlocked', { location: oilRigLocation }),
            'large',
            Constants.COLOR_LOCKED_CRATE_LARGE_OILRIG_UNLOCKED,
            this.rustplus.isFirstPoll,
            'locked_crate_large_oil_rig_logo.png',
        );

        this.crateLargeOilRigTimer?.stop();
        this.crateLargeOilRigTimer = null;
        this.crateLargeOilRigLocation = null;
    }

    getClosestMonument(x: number, y: number): Monument | null {
        let minDistance = 1_000_000;
        let closest: Monument | null = null;
        for (const monument of this.rustplus.map.monuments) {
            const distance = GameMap.getDistance(x, y, monument.x, monument.y);
            if (distance < minDistance && this.validCrateMonuments.includes(monument.token ?? '')) {
                minDistance = distance;
                closest = monument;
            }
        }
        return closest;
    }

    reset(): void {
        this.players = [];
        this.vendingMachines = [];
        this.ch47s = [];
        this.cargoShips = [];
        this.genericRadiuses = [];
        this.patrolHelicopters = [];
        this.travelingVendors = [];
        this.deepSeas = [];

        for (const timer of Object.values(this.cargoShipEgressTimers)) timer.stop();
        this.cargoShipEgressTimers = {};

        this.crateSmallOilRigTimer?.stop();
        this.crateSmallOilRigTimer = null;
        this.crateLargeOilRigTimer?.stop();
        this.crateLargeOilRigTimer = null;

        this.timeSinceCargoShipWasOut = null;
        this.timeSinceCH47WasOut = null;
        this.timeSinceSmallOilRigWasTriggered = null;
        this.timeSinceLargeOilRigWasTriggered = null;
        this.timeSincePatrolHelicopterWasOnMap = null;
        this.timeSincePatrolHelicopterWasDestroyed = null;
        this.timeSinceTravelingVendorWasOnMap = null;
        this.timeSinceDeepSeaSpawned = null;
        this.timeSinceDeepSeaWasOnMap = null;

        this.patrolHelicopterDestroyedLocation = null;
        this.knownVendingMachines = [];
        this.subscribedItemsId = [];
        this.foundItems = [];
        this.crateSmallOilRigLocation = null;
        this.crateLargeOilRigLocation = null;
        this.isDeepSeaActive = false;
    }
}
