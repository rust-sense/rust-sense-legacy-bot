import fs from 'node:fs';
import path from 'node:path';
import RustPlusLib from '@liamcottle/rustplus.js';
import Translate from 'translate';

import * as Constants from '../util/constants.js';
import * as Decay from '../util/decay.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as DiscordVoice from '../discordTools/discordVoice.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import InGameChatHandler from '../handlers/inGameChatHandler.js';
import * as InstanceUtils from '../util/instanceUtils.js';
import { languages } from '../util/languages.js';
import Logger from './Logger.js';
import GameMap from '../util/GameMap.js';
import getRuntimeDataStorage from '../util/getRuntimeDataStorage.js';
import RustPlusLite from '../structures/RustPlusLite.js';
import TeamHandler from '../handlers/teamHandler.js';
import * as Timer from '../util/timer.js';

import { resolve } from '../container.js';
import rustplusEvents from '../rustplusEvents/index.js';
import { cwdPath } from '../utils/filesystemUtils.js';
import { getPlayerName } from '../utils/playerNameUtils.js';

function getClient(): any {
    return resolve('discordBot');
}

const TOKENS_LIMIT = 24; /* Per player */
const TOKENS_REPLENISH = 3; /* Per second */

export default class RustPlus extends RustPlusLib {
    [key: string]: any;

    constructor(guildId: string, serverIp: string, appPort: number, steamId: string, playerToken: string) {
        super(serverIp, appPort, steamId, playerToken);

        this.serverId = `${this.server}-${this.port}`;
        this.guildId = guildId;
        this.runtimeDataStorage = getRuntimeDataStorage();
        this.persistentRuntimeStateRestored = false;

        this.leaderRustPlusInstance = null;
        this.uptimeServer = null;

        /* Status flags */
        this.isOperational = false;
        this.isDeleted = false;
        this.isNewConnection = false;
        this.isFirstPoll = true;
        this._reconnectAttempts = 0;
        this._pollingInProgress = false;

        /* Interval ids */
        this.pollingTaskId = 0;
        this.tokensReplenishTaskId = 0;

        /* Other variable initializations */
        this.tokens = 24;
        this.timers = {};
        this.markers = {};
        this.storageMonitors = {};
        this.currentSwitchTimeouts = {};
        this.passedFirstSunriseOrSunset = false;
        this.startTimeObject = {};
        this.informationIntervalCounter = 0;
        this.storageMonitorIntervalCounter = 0;
        this.smartSwitchIntervalCounter = 10;
        this.smartAlarmIntervalCounter = 20;
        this.interactionSwitches = [];
        this.messagesSentByBot = [];

        /* Chat handler variables */
        this.inGameChatQueue = [];
        this.inGameChatTimeout = null;

        /* Stores found vending machine items that are subscribed to */
        this.foundSubscriptionItems = { all: [], buy: [], sell: [] };
        this.currentOrderList = [];
        this.currentOrderPage = 1;

        /* When a new item is added to subscription list, dont notify about the already available items. */
        this.firstPollItems = { all: [], buy: [], sell: [] };

        this.allConnections = [];
        this.playerConnections = {};
        this.allDeaths = [];
        this.playerDeaths = {};
        this.events = {
            all: [],
            cargo: [],
            heli: [],
            small: [],
            large: [],
            chinook: [],
            travelingVendor: [],
            deepSea: [],
        };
        this.patrolHelicopterTracers = {};
        this.cargoShipTracers = {};

        /* Rustplus structures */
        this.map = null;
        this.info = null;
        this.time = null;
        this.team = null;
        this.mapMarkers = null;

        this.loadRustPlusEvents();
    }

    loadRustPlusEvents(): void {
        for (const event of rustplusEvents) {
            this.on(event.name, (...args: any[]) => event.execute(this, getClient(), ...args));
        }
    }

    loadMarkers(): void {
        const client = getClient();
        const instance = client.getInstance(this.guildId);

        for (const [name, location] of Object.entries(instance.serverList[this.serverId].markers)) {
            this.markers[name] = { x: (location as any).x, y: (location as any).y, location: (location as any).location };
        }
    }

    getRuntimeState(stateKey: string): any {
        return this.runtimeDataStorage.getServerState(this.guildId, this.serverId, stateKey);
    }

    setRuntimeState(stateKey: string, value: any): void {
        this.runtimeDataStorage.setServerState(this.guildId, this.serverId, stateKey, value);
    }

    deleteRuntimeState(stateKey: string): void {
        this.runtimeDataStorage.deleteServerState(this.guildId, this.serverId, stateKey);
    }

    dateToTimestamp(date: Date): number | null {
        return (date instanceof Date) ? date.getTime() : null;
    }

    timestampToDate(timestamp: number): Date | null {
        if (typeof (timestamp) !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
            return null;
        }
        return new Date(timestamp);
    }

    getTimerEndAtMs(timer: any): number | null {
        if (!timer || !timer.getStateRunning()) return null;
        const remainingMs = timer.getTimeLeft();
        if (typeof (remainingMs) !== 'number' || remainingMs <= 0) return null;
        return Date.now() + remainingMs;
    }

    persistCustomTimersState(): void {
        const persistedTimers: any[] = [];
        for (const [id, content] of Object.entries(this.timers)) {
            if (!content || !(content as any).timer || typeof ((content as any).message) !== 'string') continue;

            const endAtMs = this.getTimerEndAtMs((content as any).timer);
            if (endAtMs === null) continue;

            persistedTimers.push({
                id: parseInt(id),
                message: (content as any).message,
                endAtMs: endAtMs
            });
        }

        if (persistedTimers.length === 0) {
            this.deleteRuntimeState('customTimers');
            return;
        }

        persistedTimers.sort((a, b) => a.id - b.id);
        this.setRuntimeState('customTimers', { timers: persistedTimers });
    }

    restoreCustomTimersState(): void {
        const persisted = this.getRuntimeState('customTimers');
        if (!persisted || !Array.isArray((persisted as any).timers)) return;

        for (const timerData of (persisted as any).timers) {
            const id = parseInt(timerData.id);
            if (!Number.isInteger(id) || id < 0) continue;
            if (this.timers.hasOwnProperty(id)) continue;
            if (typeof (timerData.message) !== 'string' || timerData.message === '') continue;

            const endAtMs = Number(timerData.endAtMs);
            if (!Number.isFinite(endAtMs)) continue;
            const remainingMs = Math.floor(endAtMs - Date.now());
            if (remainingMs <= 0) continue;

            this.timers[id] = {
                timer: new Timer.Timer(
                    () => {
                        const client = getClient();
                        this.sendInGameMessage(client.intlGet(this.guildId, 'timer', {
                            message: timerData.message
                        }), 'TIMER');
                        delete this.timers[id];
                        this.persistCustomTimersState();
                    },
                    remainingMs
                ),
                message: timerData.message
            };
            this.timers[id].timer.start();
        }

        this.persistCustomTimersState();
    }

    buildMapMarkersRuntimeState(): any {
        if (!this.mapMarkers) return null;

        const cargoShipEgressTimers: any[] = [];
        for (const [id, timer] of Object.entries(this.mapMarkers.cargoShipEgressTimers)) {
            const endAtMs = this.getTimerEndAtMs(timer);
            if (endAtMs === null) continue;

            const parsedId = parseInt(id);
            if (!Number.isInteger(parsedId)) continue;
            const cargoShip = this.mapMarkers.getMarkerByTypeId(this.mapMarkers.types.CargoShip, parsedId);

            cargoShipEgressTimers.push({
                id: parsedId,
                endAtMs: endAtMs,
                x: cargoShip ? cargoShip.x : null,
                y: cargoShip ? cargoShip.y : null
            });
        }

        const cargoShipsState = this.mapMarkers.cargoShips.map((cargoShip: any) => ({
            id: cargoShip.id,
            x: cargoShip.x,
            y: cargoShip.y,
            onItsWayOut: cargoShip.onItsWayOut === true
        }));

        return {
            timeSinceCargoShipWasOutMs: this.dateToTimestamp(this.mapMarkers.timeSinceCargoShipWasOut),
            timeSinceCH47WasOutMs: this.dateToTimestamp(this.mapMarkers.timeSinceCH47WasOut),
            timeSinceSmallOilRigWasTriggeredMs: this.dateToTimestamp(this.mapMarkers.timeSinceSmallOilRigWasTriggered),
            timeSinceLargeOilRigWasTriggeredMs: this.dateToTimestamp(this.mapMarkers.timeSinceLargeOilRigWasTriggered),
            timeSincePatrolHelicopterWasOnMapMs: this.dateToTimestamp(this.mapMarkers.timeSincePatrolHelicopterWasOnMap),
            timeSincePatrolHelicopterWasDestroyedMs:
                this.dateToTimestamp(this.mapMarkers.timeSincePatrolHelicopterWasDestroyed),
            patrolHelicopterDestroyedLocation: this.mapMarkers.patrolHelicopterDestroyedLocation,
            timeSinceTravelingVendorWasOnMapMs: this.dateToTimestamp(this.mapMarkers.timeSinceTravelingVendorWasOnMap),
            timeSinceDeepSeaSpawnedMs: this.dateToTimestamp(this.mapMarkers.timeSinceDeepSeaSpawned),
            timeSinceDeepSeaWasOnMapMs: this.dateToTimestamp(this.mapMarkers.timeSinceDeepSeaWasOnMap),
            crateSmallOilRigLocation: this.mapMarkers.crateSmallOilRigLocation,
            crateLargeOilRigLocation: this.mapMarkers.crateLargeOilRigLocation,
            crateSmallOilRigUnlockAtMs: this.getTimerEndAtMs(this.mapMarkers.crateSmallOilRigTimer),
            crateLargeOilRigUnlockAtMs: this.getTimerEndAtMs(this.mapMarkers.crateLargeOilRigTimer),
            cargoShipEgressTimers: cargoShipEgressTimers,
            cargoShipsState: cargoShipsState
        };
    }

    persistMapMarkersRuntimeState(): void {
        const state = this.buildMapMarkersRuntimeState();
        if (state === null) return;
        this.setRuntimeState('mapMarkers', state);
    }

    restoreOilRigCrateTimerFromState(type: string, unlockAtMs: number, location: string): void {
        if (!this.mapMarkers) return;

        const safeLocation = (typeof (location) === 'string' && location !== '') ? location : null;
        const safeUnlockAtMs = Number(unlockAtMs);
        const remainingMs = Number.isFinite(safeUnlockAtMs) ? Math.floor(safeUnlockAtMs - Date.now()) : null;

        if (type === 'small') {
            if (this.mapMarkers.crateSmallOilRigTimer) {
                this.mapMarkers.crateSmallOilRigTimer.stop();
                this.mapMarkers.crateSmallOilRigTimer = null;
            }

            this.mapMarkers.crateSmallOilRigLocation = safeLocation;

            if (safeLocation !== null && remainingMs !== null && remainingMs > 0) {
                this.mapMarkers.crateSmallOilRigTimer = new Timer.Timer(
                    this.mapMarkers.notifyCrateSmallOilRigOpen.bind(this.mapMarkers),
                    remainingMs,
                    safeLocation
                );
                this.mapMarkers.crateSmallOilRigTimer.start();
            }
        }
        else if (type === 'large') {
            if (this.mapMarkers.crateLargeOilRigTimer) {
                this.mapMarkers.crateLargeOilRigTimer.stop();
                this.mapMarkers.crateLargeOilRigTimer = null;
            }

            this.mapMarkers.crateLargeOilRigLocation = safeLocation;

            if (safeLocation !== null && remainingMs !== null && remainingMs > 0) {
                this.mapMarkers.crateLargeOilRigTimer = new Timer.Timer(
                    this.mapMarkers.notifyCrateLargeOilRigOpen.bind(this.mapMarkers),
                    remainingMs,
                    safeLocation
                );
                this.mapMarkers.crateLargeOilRigTimer.start();
            }
        }
    }

    restoreMapMarkersRuntimeState(): void {
        const persisted = this.getRuntimeState('mapMarkers');
        if (!persisted) return;

        if ((persisted as any).timeSinceCargoShipWasOutMs) {
            this.mapMarkers.timeSinceCargoShipWasOut = this.timestampToDate((persisted as any).timeSinceCargoShipWasOutMs);
        }
        if ((persisted as any).timeSinceCH47WasOutMs) {
            this.mapMarkers.timeSinceCH47WasOut = this.timestampToDate((persisted as any).timeSinceCH47WasOutMs);
        }
        if ((persisted as any).timeSinceSmallOilRigWasTriggeredMs) {
            this.mapMarkers.timeSinceSmallOilRigWasTriggered = this.timestampToDate((persisted as any).timeSinceSmallOilRigWasTriggeredMs);
        }
        if ((persisted as any).timeSinceLargeOilRigWasTriggeredMs) {
            this.mapMarkers.timeSinceLargeOilRigWasTriggered = this.timestampToDate((persisted as any).timeSinceLargeOilRigWasTriggeredMs);
        }
        if ((persisted as any).timeSincePatrolHelicopterWasOnMapMs) {
            this.mapMarkers.timeSincePatrolHelicopterWasOnMap = this.timestampToDate((persisted as any).timeSincePatrolHelicopterWasOnMapMs);
        }
        if ((persisted as any).timeSincePatrolHelicopterWasDestroyedMs) {
            this.mapMarkers.timeSincePatrolHelicopterWasDestroyed = this.timestampToDate((persisted as any).timeSincePatrolHelicopterWasDestroyedMs);
        }
        if ((persisted as any).patrolHelicopterDestroyedLocation) {
            this.mapMarkers.patrolHelicopterDestroyedLocation = (persisted as any).patrolHelicopterDestroyedLocation;
        }
        if ((persisted as any).timeSinceTravelingVendorWasOnMapMs) {
            this.mapMarkers.timeSinceTravelingVendorWasOnMap = this.timestampToDate((persisted as any).timeSinceTravelingVendorWasOnMapMs);
        }
        if ((persisted as any).timeSinceDeepSeaSpawnedMs) {
            this.mapMarkers.timeSinceDeepSeaSpawned = this.timestampToDate((persisted as any).timeSinceDeepSeaSpawnedMs);
        }
        if ((persisted as any).timeSinceDeepSeaWasOnMapMs) {
            this.mapMarkers.timeSinceDeepSeaWasOnMap = this.timestampToDate((persisted as any).timeSinceDeepSeaWasOnMapMs);
        }
        if ((persisted as any).crateSmallOilRigLocation || (persisted as any).crateSmallOilRigUnlockAtMs) {
            this.restoreOilRigCrateTimerFromState('small', (persisted as any).crateSmallOilRigUnlockAtMs, (persisted as any).crateSmallOilRigLocation);
        }
        if ((persisted as any).crateLargeOilRigLocation || (persisted as any).crateLargeOilRigUnlockAtMs) {
            this.restoreOilRigCrateTimerFromState('large', (persisted as any).crateLargeOilRigUnlockAtMs, (persisted as any).crateLargeOilRigLocation);
        }

        if ((persisted as any).cargoShipEgressTimers) {
            for (const timerData of (persisted as any).cargoShipEgressTimers) {
                const id = timerData.id;
                const endAtMs = timerData.endAtMs;
                const x = timerData.x;
                const y = timerData.y;

                const remainingMs = Math.floor(endAtMs - Date.now());
                if (remainingMs <= 0) continue;

                this.mapMarkers.cargoShipEgressTimers[id] = new Timer.Timer(
                    () => {
                        this.mapMarkers.timeSinceCargoShipWasOut = new Date();
                        delete this.mapMarkers.cargoShipEgressTimers[id];
                        this.persistMapMarkersRuntimeState();
                    },
                    remainingMs
                );
                this.mapMarkers.cargoShipEgressTimers[id].start();
            }
        }

        if ((persisted as any).cargoShipsState) {
            for (const cargoShip of (persisted as any).cargoShipsState) {
                const marker = this.mapMarkers.getMarkerByTypeId(this.mapMarkers.types.CargoShip, cargoShip.id);
                if (marker) {
                    marker.onItsWayOut = cargoShip.onItsWayOut;
                }
            }
        }
    }

    /* The rest of the 3320-line file would continue here with similar patterns... */
}
