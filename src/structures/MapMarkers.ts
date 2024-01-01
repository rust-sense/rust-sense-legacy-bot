/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

import Constants from '../util/constants.js';

import Map from '../util/map.js';
import Timer from '../util/timer';

class MapMarkers {
    _cargoShips: any;
    _ch47s: any;
    _client: any;
    _genericRadiuses: any;
    _markers: any;
    _patrolHelicopters: any;
    _players: any;
    _rustplus: any;
    _types: any;
    _vendingMachines: any;
    cargoShipEgressTimers: any;
    crateLargeOilRigLocation: any;
    crateLargeOilRigTimer: any;
    crateSmallOilRigLocation: any;
    crateSmallOilRigTimer: any;
    foundItems: any;
    knownVendingMachines: any;
    patrolHelicopterDestroyedLocation: any;
    subscribedItemsId: any;
    timeSinceCH47WasOut: any;
    timeSinceCargoShipWasOut: any;
    timeSinceLargeOilRigWasTriggered: any;
    timeSincePatrolHelicopterWasDestroyed: any;
    timeSincePatrolHelicopterWasOnMap: any;
    timeSinceSmallOilRigWasTriggered: any;
    validCrateMonuments: any;
    constructor(mapMarkers, rustplus, client) {
        this._markers = mapMarkers.markers;

        this._rustplus = rustplus;
        this._client = client;

        this._types = {
            Player: 1,
            Explosion: 2,
            VendingMachine: 3,
            CH47: 4,
            CargoShip: 5,
            Crate: 6,
            GenericRadius: 7,
            PatrolHelicopter: 8,
        };

        this._players = [];
        this._vendingMachines = [];
        this._ch47s = [];
        this._cargoShips = [];
        this._genericRadiuses = [];
        this._patrolHelicopters = [];

        /* Timers */
        this.cargoShipEgressTimers = new Object();
        this.crateSmallOilRigTimer = null;
        this.crateSmallOilRigLocation = null;
        this.crateLargeOilRigTimer = null;
        this.crateLargeOilRigLocation = null;

        /* Event dates */
        this.timeSinceCargoShipWasOut = null;
        this.timeSinceCH47WasOut = null;
        this.timeSinceSmallOilRigWasTriggered = null;
        this.timeSinceLargeOilRigWasTriggered = null;
        this.timeSincePatrolHelicopterWasOnMap = null;
        this.timeSincePatrolHelicopterWasDestroyed = null;

        /* Event location */
        this.patrolHelicopterDestroyedLocation = null;

        /* Vending Machine variables */
        this.knownVendingMachines = [];

        this.updateMapMarkers(mapMarkers);
    }

    /* Getters and Setters */
    get markers() {
        return this._markers;
    }
    set markers(markers) {
        this._markers = markers;
    }
    get rustplus() {
        return this._rustplus;
    }
    set rustplus(rustplus) {
        this._rustplus = rustplus;
    }
    get client() {
        return this._client;
    }
    set client(client) {
        this._client = client;
    }
    get types() {
        return this._types;
    }
    set types(types) {
        this._types = types;
    }
    get players() {
        return this._players;
    }
    set players(players) {
        this._players = players;
    }
    get vendingMachines() {
        return this._vendingMachines;
    }
    set vendingMachines(vendingMachines) {
        this._vendingMachines = vendingMachines;
    }
    get ch47s() {
        return this._ch47s;
    }
    set ch47s(ch47s) {
        this._ch47s = ch47s;
    }
    get cargoShips() {
        return this._cargoShips;
    }
    set cargoShips(cargoShips) {
        this._cargoShips = cargoShips;
    }
    get genericRadiuses() {
        return this._genericRadiuses;
    }
    set genericRadiuses(genericRadiuses) {
        this._genericRadiuses = genericRadiuses;
    }
    get patrolHelicopters() {
        return this._patrolHelicopters;
    }
    set patrolHelicopters(patrolHelicopters) {
        this._patrolHelicopters = patrolHelicopters;
    }

    getType(type) {
        if (!Object.values(this.types).includes(type)) {
            return null;
        }

        switch (type) {
            case this.types.Player:
                {
                    return this.players;
                }
                break;

            case this.types.VendingMachine:
                {
                    return this.vendingMachines;
                }
                break;

            case this.types.CH47:
                {
                    return this.ch47s;
                }
                break;

            case this.types.CargoShip:
                {
                    return this.cargoShips;
                }
                break;

            case this.types.GenericRadius:
                {
                    return this.genericRadiuses;
                }
                break;

            case this.types.PatrolHelicopter:
                {
                    return this.patrolHelicopters;
                }
                break;

            default:
                {
                    return null;
                }
                break;
        }
    }

    getMarkersOfType(type, markers) {
        if (!Object.values(this.types).includes(type)) {
            return [];
        }

        const markersOfType = [];
        for (const marker of markers) {
            if (marker.type === type) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
                markersOfType.push(marker);
            }
        }

        return markersOfType;
    }

    getMarkerByTypeId(type, id) {
        return this.getType(type).find((e) => e.id === id);
    }

    getMarkerByTypeXY(type, x, y) {
        return this.getType(type).find((e) => e.x === x && e.y === y);
    }

    isMarkerPresentByTypeId(type, id, markers = null) {
        if (markers) {
            // @ts-expect-error TS(2339) FIXME: Property 'some' does not exist on type 'never'.
            return markers.some((e) => e.id === id);
        } else {
            return this.getType(type).some((e) => e.id === id);
        }
    }

    getNewMarkersOfTypeId(type, markers) {
        const newMarkersOfType = [];

        for (const marker of this.getMarkersOfType(type, markers)) {
            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            if (!this.isMarkerPresentByTypeId(type, marker.id)) {
                newMarkersOfType.push(marker);
            }
        }

        return newMarkersOfType;
    }

    getLeftMarkersOfTypeId(type, markers) {
        let leftMarkersOfType = this.getType(type).slice();

        for (const marker of this.getMarkersOfType(type, markers)) {
            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            if (this.isMarkerPresentByTypeId(type, marker.id)) {
                // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
                leftMarkersOfType = leftMarkersOfType.filter((e) => e.id !== marker.id);
            }
        }

        return leftMarkersOfType;
    }

    getRemainingMarkersOfTypeId(type, markers) {
        const remainingMarkersOfType = [];

        for (const marker of markers) {
            if (this.isMarkerPresentByTypeId(type, marker.id)) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
                remainingMarkersOfType.push(marker);
            }
        }

        return remainingMarkersOfType;
    }

    isMarkerPresentByTypeXY(type, x, y, markers = null) {
        if (markers) {
            // @ts-expect-error TS(2339) FIXME: Property 'some' does not exist on type 'never'.
            return markers.some((e) => e.x === x && e.y === y);
        } else {
            return this.getType(type).some((e) => e.x === x && e.y === y);
        }
    }

    getNewMarkersOfTypeXY(type, markers) {
        const newMarkersOfType = [];

        for (const marker of this.getMarkersOfType(type, markers)) {
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            if (!this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                newMarkersOfType.push(marker);
            }
        }

        return newMarkersOfType;
    }

    getLeftMarkersOfTypeXY(type, markers) {
        let leftMarkersOfType = this.getType(type).slice();

        for (const marker of this.getMarkersOfType(type, markers)) {
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            if (this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
                leftMarkersOfType = leftMarkersOfType.filter((e) => e.x !== marker.x) || e.y !== marker.y;
            }
        }

        return leftMarkersOfType;
    }

    getRemainingMarkersOfTypeXY(type, markers) {
        const remainingMarkersOfType = [];

        for (const marker of markers) {
            if (this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                // @ts-expect-error TS(2345) FIXME: Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
                remainingMarkersOfType.push(marker);
            }
        }

        return remainingMarkersOfType;
    }

    /* Update event map markers */

    updateMapMarkers(mapMarkers) {
        this.updatePlayers(mapMarkers);
        this.updateCargoShips(mapMarkers);
        this.updatePatrolHelicopters(mapMarkers);
        this.updateCH47s(mapMarkers);
        this.updateVendingMachines(mapMarkers);
        this.updateGenericRadiuses(mapMarkers);
    }

    updatePlayers(mapMarkers) {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.Player, mapMarkers.markers);

        /* Player markers that are new. */
        for (const marker of newMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            // @ts-expect-error TS(2339) FIXME: Property 'location' does not exist on type 'never'... Remove this comment to see the full error message
            marker.location = pos;

            this.players.push(marker);
        }

        /* Player markers that have left. */
        for (const marker of leftMarkers) {
            this.players = this.players.filter((e) => e.id !== marker.id);
        }

        /* Player markers that still remains. */
        for (const marker of remainingMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            const player = this.getMarkerByTypeId(this.types.Player, marker.id);

            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            player.x = marker.x;
            // @ts-expect-error TS(2339) FIXME: Property 'y' does not exist on type 'never'.
            player.y = marker.y;
            player.location = pos;
        }
    }

    updateVendingMachines(mapMarkers) {
        const newMarkers = this.getNewMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);

        /* VendingMachine markers that are new. */
        for (const marker of newMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            // @ts-expect-error TS(2339) FIXME: Property 'location' does not exist on type 'never'... Remove this comment to see the full error message
            marker.location = pos;

            if (!this.rustplus.isFirstPoll) {
                // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
                if (!this.knownVendingMachines.some((e) => e.x === marker.x && e.y === marker.y)) {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.vendingMachineDetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'newVendingMachine', { location: pos.string }),
                        null,
                        Constants.COLOR_NEW_VENDING_MACHINE,
                    );
                }
            }

            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            this.knownVendingMachines.push({ x: marker.x, y: marker.y });
            this.vendingMachines.push(marker);
        }

        /* VendingMachine markers that have left. */
        for (const marker of leftMarkers) {
            // @ts-expect-error TS(2304) FIXME: Cannot find name 'e'.
            this.vendingMachines = this.vendingMachines.filter((e) => e.x !== marker.x) || e.y !== marker.y;
        }

        /* VendingMachine markers that still remains. */
        for (const marker of remainingMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const vendingMachine = this.getMarkerByTypeXY(this.types.VendingMachine, marker.x, marker.y);

            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            vendingMachine.id = marker.id;
            vendingMachine.location = pos;
        }
    }

    updateCH47s(mapMarkers) {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.CH47, mapMarkers.markers);

        /* CH47 markers that are new. */
        for (const marker of newMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            // @ts-expect-error TS(2339) FIXME: Property 'location' does not exist on type 'never'... Remove this comment to see the full error message
            marker.location = pos;

            const smallOilRig = [],
                largeOilRig = [];
            for (const monument of this.rustplus.map.monuments) {
                if (monument.token === 'oil_rig_small') {
                    // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
                    smallOilRig.push({ x: monument.x, y: monument.y });
                } else if (monument.token === 'large_oil_rig') {
                    // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
                    largeOilRig.push({ x: monument.x, y: monument.y });
                }
            }

            let found = false;
            if (!this.rustplus.isFirstPoll) {
                for (const oilRig of smallOilRig) {
                    // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
                    if (
                        Map.getDistance(marker.x, marker.y, oilRig.x, oilRig.y) <=
                        Constants.OIL_RIG_CHINOOK_47_MAX_SPAWN_DISTANCE
                    ) {
                        found = true;
                        // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
                        const oilRigLocation = Map.getPos(oilRig.x, oilRig.y, mapSize, this.rustplus);
                        // @ts-expect-error TS(2339) FIXME: Property 'ch47Type' does not exist on type 'never'... Remove this comment to see the full error message
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

                        if (this.crateSmallOilRigTimer) {
                            this.crateSmallOilRigTimer.stop();
                        }

                        const instance = this.client.getInstance(this.rustplus.guildId);
                        this.crateSmallOilRigTimer = new Timer.timer(
                            this.notifyCrateSmallOilRigOpen.bind(this),
                            instance.serverList[this.rustplus.serverId].oilRigLockedCrateUnlockTimeMs,
                            oilRigLocation.location,
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
                    // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
                    if (
                        Map.getDistance(marker.x, marker.y, oilRig.x, oilRig.y) <=
                        Constants.OIL_RIG_CHINOOK_47_MAX_SPAWN_DISTANCE
                    ) {
                        found = true;
                        // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
                        const oilRigLocation = Map.getPos(oilRig.x, oilRig.y, mapSize, this.rustplus);
                        // @ts-expect-error TS(2339) FIXME: Property 'ch47Type' does not exist on type 'never'... Remove this comment to see the full error message
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

                        if (this.crateLargeOilRigTimer) {
                            this.crateLargeOilRigTimer.stop();
                        }

                        const instance = this.client.getInstance(this.rustplus.guildId);
                        this.crateLargeOilRigTimer = new Timer.timer(
                            this.notifyCrateLargeOilRigOpen.bind(this),
                            instance.serverList[this.rustplus.serverId].oilRigLockedCrateUnlockTimeMs,
                            oilRigLocation.location,
                        );
                        this.crateLargeOilRigTimer.start();

                        this.crateLargeOilRigLocation = oilRigLocation.location;
                        this.timeSinceLargeOilRigWasTriggered = new Date();
                        break;
                    }
                }
            }

            if (!found) {
                /* Offset that is used to determine if CH47 just spawned */
                const offset = 4 * Map.gridDiameter;

                /* If CH47 is located outside the grid system + the offset */
                // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
                if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
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
                // @ts-expect-error TS(2339) FIXME: Property 'ch47Type' does not exist on type 'never'... Remove this comment to see the full error message
                marker.ch47Type = 'crate';
            }

            this.ch47s.push(marker);
        }

        /* CH47 markers that have left. */
        for (const marker of leftMarkers) {
            if (marker.ch47Type === 'crate') {
                this.timeSinceCH47WasOut = new Date();
                this.rustplus.log(
                    this.client.intlGet(null, 'eventCap'),
                    this.client.intlGet(null, 'chinook47LeftMap', { location: marker.location.string }),
                );
            }

            this.ch47s = this.ch47s.filter((e) => e.id !== marker.id);
        }

        /* CH47 markers that still remains. */
        for (const marker of remainingMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            const ch47 = this.getMarkerByTypeId(this.types.CH47, marker.id);

            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            ch47.x = marker.x;
            // @ts-expect-error TS(2339) FIXME: Property 'y' does not exist on type 'never'.
            ch47.y = marker.y;
            ch47.location = pos;
        }
    }

    updateCargoShips(mapMarkers) {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);

        /* CargoShip markers that are new. */
        for (const marker of newMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            this.rustplus.cargoShipTracers[marker.id] = [{ x: marker.x, y: marker.y }];

            // @ts-expect-error TS(2339) FIXME: Property 'location' does not exist on type 'never'... Remove this comment to see the full error message
            marker.location = pos;
            // @ts-expect-error TS(2339) FIXME: Property 'onItsWayOut' does not exist on type 'nev... Remove this comment to see the full error message
            marker.onItsWayOut = false;

            /* Offset that is used to determine if CargoShip just spawned */
            const offset = 4 * Map.gridDiameter;

            /* If CargoShip is located outside the grid system + the offset */
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.cargoShipDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'cargoShipEntersMap', { location: pos.string }),
                    'cargo',
                    Constants.COLOR_CARGO_SHIP_ENTERS_MAP,
                );

                const instance = this.client.getInstance(this.rustplus.guildId);
                // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
                this.cargoShipEgressTimers[marker.id] = new Timer.timer(
                    this.notifyCargoShipEgress.bind(this),
                    instance.serverList[this.rustplus.serverId].cargoShipEgressTimeMs,
                    // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
                    marker.id,
                );
                // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
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

        /* CargoShip markers that have left. */
        for (const marker of leftMarkers) {
            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.cargoShipLeftSetting,
                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeftMap', { location: marker.location.string }),
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

        /* CargoShip markers that still remains. */
        for (const marker of remainingMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            const cargoShip = this.getMarkerByTypeId(this.types.CargoShip, marker.id);

            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            this.rustplus.cargoShipTracers[marker.id].push({ x: marker.x, y: marker.y });

            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            cargoShip.x = marker.x;
            // @ts-expect-error TS(2339) FIXME: Property 'y' does not exist on type 'never'.
            cargoShip.y = marker.y;
            cargoShip.location = pos;
        }
    }

    updateGenericRadiuses(mapMarkers) {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);

        /* GenericRadius markers that are new. */
        for (const marker of newMarkers) {
            this.genericRadiuses.push(marker);
        }

        /* GenericRadius markers that have left. */
        for (const marker of leftMarkers) {
            this.genericRadiuses = this.genericRadiuses.filter((e) => e.id !== marker.id);
        }

        /* GenericRadius markers that still remains. */
        for (const marker of remainingMarkers) {
            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            const genericRadius = this.getMarkerByTypeId(this.types.GenericRadius, marker.id);

            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            genericRadius.x = marker.x;
            // @ts-expect-error TS(2339) FIXME: Property 'y' does not exist on type 'never'.
            genericRadius.y = marker.y;
        }
    }

    updatePatrolHelicopters(mapMarkers) {
        const newMarkers = this.getNewMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        const leftMarkers = this.getLeftMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        const remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);

        /* PatrolHelicopter markers that are new. */
        for (const marker of newMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            this.rustplus.patrolHelicopterTracers[marker.id] = [{ x: marker.x, y: marker.y }];

            // @ts-expect-error TS(2339) FIXME: Property 'location' does not exist on type 'never'... Remove this comment to see the full error message
            marker.location = pos;

            /* Offset that is used to determine if PatrolHelicopter just spawned */
            const offset = 4 * Map.gridDiameter;

            /* If PatrolHelicopter is located outside the grid system + the offset */
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterEntersMap', {
                        location: pos.string,
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_ENTERS_MAP,
                );
            } else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterLocatedAt', {
                        location: pos.string,
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_LOCATED_AT,
                );
            }

            this.patrolHelicopters.push(marker);
        }

        /* PatrolHelicopter markers that have left. */
        for (const marker of leftMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;

            if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterLeftSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterLeftMap', {
                        location: marker.location.string,
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_LEFT_MAP,
                );

                this.timeSincePatrolHelicopterWasOnMap = new Date();
            } else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDestroyedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterTakenDown', {
                        location: marker.location.string,
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_TAKEN_DOWN,
                );

                this.timeSincePatrolHelicopterWasDestroyed = new Date();
                this.timeSincePatrolHelicopterWasOnMap = new Date();

                this.patrolHelicopterDestroyedLocation = Map.getGridPos(marker.x, marker.y, mapSize);
            }

            this.patrolHelicopters = this.patrolHelicopters.filter((e) => e.id !== marker.id);
            delete this.rustplus.patrolHelicopterTracers[marker.id];
        }

        /* PatrolHelicopter markers that still remains. */
        for (const marker of remainingMarkers) {
            const mapSize = this.rustplus.info.correctedMapSize;
            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            const pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            const patrolHelicopter = this.getMarkerByTypeId(this.types.PatrolHelicopter, marker.id);

            // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type 'never'.
            this.rustplus.patrolHelicopterTracers[marker.id].push({ x: marker.x, y: marker.y });

            // @ts-expect-error TS(2339) FIXME: Property 'x' does not exist on type 'never'.
            patrolHelicopter.x = marker.x;
            // @ts-expect-error TS(2339) FIXME: Property 'y' does not exist on type 'never'.
            patrolHelicopter.y = marker.y;
            patrolHelicopter.location = pos;
        }
    }

    /* Timer notification functions */

    notifyCargoShipEgress(args) {
        const id = args[0];
        const marker = this.getMarkerByTypeId(this.types.CargoShip, id);

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.cargoShipEgressSetting,
            this.client.intlGet(this.rustplus.guildId, 'cargoShipEntersEgressStage', {
                location: marker.location.string,
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

    notifyCrateSmallOilRigOpen(args) {
        const oilRigLocation = args[0];

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.lockedCrateOilRigUnlockedSetting,
            this.client.intlGet(this.rustplus.guildId, 'lockedCrateSmallOilRigUnlocked', {
                location: oilRigLocation,
            }),
            'small',
            Constants.COLOR_LOCKED_CRATE_SMALL_OILRIG_UNLOCKED,
            this.rustplus.isFirstPoll,
            'locked_crate_small_oil_rig_logo.png',
        );

        this.crateSmallOilRigTimer.stop();
        this.crateSmallOilRigTimer = null;
        this.crateSmallOilRigLocation = null;
    }

    notifyCrateLargeOilRigOpen(args) {
        const oilRigLocation = args[0];

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.lockedCrateOilRigUnlockedSetting,
            this.client.intlGet(this.rustplus.guildId, 'lockedCrateLargeOilRigUnlocked', {
                location: oilRigLocation,
            }),
            'large',
            Constants.COLOR_LOCKED_CRATE_LARGE_OILRIG_UNLOCKED,
            this.rustplus.isFirstPoll,
            'locked_crate_large_oil_rig_logo.png',
        );

        this.crateLargeOilRigTimer.stop();
        this.crateLargeOilRigTimer = null;
        this.crateLargeOilRigLocation = null;
    }

    /* Help functions */

    getClosestMonument(x, y) {
        let minDistance = 1000000;
        let closestMonument = null;
        for (const monument of this.rustplus.map.monuments) {
            const distance = Map.getDistance(x, y, monument.x, monument.y);
            if (distance < minDistance && this.validCrateMonuments.includes(monument.token)) {
                minDistance = distance;
                closestMonument = monument;
            }
        }

        return closestMonument;
    }

    reset() {
        this.players = [];
        this.vendingMachines = [];
        this.ch47s = [];
        this.cargoShips = [];
        this.genericRadiuses = [];
        this.patrolHelicopters = [];

        for (const [id, timer] of Object.entries(this.cargoShipEgressTimers)) {
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            timer.stop();
        }
        this.cargoShipEgressTimers = new Object();
        if (this.crateSmallOilRigTimer) {
            this.crateSmallOilRigTimer.stop();
        }
        this.crateSmallOilRigTimer = null;
        if (this.crateLargeOilRigTimer) {
            this.crateLargeOilRigTimer.stop();
        }
        this.crateLargeOilRigTimer = null;

        this.timeSinceCargoShipWasOut = null;
        this.timeSinceCH47WasOut = null;
        this.timeSinceSmallOilRigWasTriggered = null;
        this.timeSinceLargeOilRigWasTriggered = null;
        this.timeSincePatrolHelicopterWasOnMap = null;
        this.timeSincePatrolHelicopterWasDestroyed = null;

        this.patrolHelicopterDestroyedLocation = null;

        this.knownVendingMachines = [];
        this.subscribedItemsId = [];
        this.foundItems = [];

        this.crateSmallOilRigLocation = null;
        this.crateLargeOilRigLocation = null;
    }
}

export default MapMarkers;
