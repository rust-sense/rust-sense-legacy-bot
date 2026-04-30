import fs from 'node:fs';
import path from 'node:path';
import Translate from 'translate';
import { resolve } from '../container.js';
import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as DiscordVoice from '../discordTools/discordVoice.js';
import * as InGameChatHandler from '../handlers/inGameChatHandler.js';
import * as TeamHandler from '../handlers/teamHandler.js';
import { RustPlus as RustPlusLib } from '../lib/rustplus/RustPlus.js';
import rustplusEvents from '../rustplusEvents/index.js';
import RustPlusLite from '../structures/RustPlusLite.js';
import type { RustplusEvent } from '../types/discord.js';
import * as Constants from '../util/constants.js';
import * as Decay from '../util/decay.js';
import * as GameMap from '../util/GameMap.js';
import getRuntimeDataStorage from '../util/getRuntimeDataStorage.js';
import * as InstanceUtils from '../util/instanceUtils.js';
import { languages } from '../util/languages.js';
import * as Timer from '../util/timer.js';
import { getPlayerName } from '../utils/playerNameUtils.js';
import Logger from './Logger.js';

function getClient(): any {
    return resolve('discordBot');
}

const TOKENS_LIMIT = 24; /* Per player */
const TOKENS_REPLENISH = 3; /* Per second */

interface PersistedTimerData {
    id: number;
    message: string;
    endAtMs: number;
}

interface PersistedCargoShipEgressTimer {
    id: number;
    endAtMs: number;
    x: number | null;
    y: number | null;
}

interface PersistedCargoShipState {
    id: number;
    x: number;
    y: number;
    onItsWayOut: boolean;
}

interface PersistedRuntimeState {
    timers?: PersistedTimerData[];
    timeSinceCargoShipWasOutMs?: number;
    timeSinceCH47WasOutMs?: number;
    timeSinceSmallOilRigWasTriggeredMs?: number;
    timeSinceLargeOilRigWasTriggeredMs?: number;
    timeSincePatrolHelicopterWasOnMapMs?: number;
    timeSincePatrolHelicopterWasDestroyedMs?: number;
    patrolHelicopterDestroyedLocation?: string;
    timeSinceTravelingVendorWasOnMapMs?: number;
    timeSinceDeepSeaSpawnedMs?: number;
    timeSinceDeepSeaWasOnMapMs?: number;
    crateSmallOilRigLocation?: string;
    crateSmallOilRigUnlockAtMs?: number;
    crateLargeOilRigLocation?: string;
    crateLargeOilRigUnlockAtMs?: number;
    cargoShipEgressTimers?: PersistedCargoShipEgressTimer[];
    cargoShipsState?: PersistedCargoShipState[];
}

export default class RustPlus extends RustPlusLib {
    [key: string]: any;

    serverId!: string;
    guildId!: string;

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
        for (const event of rustplusEvents as RustplusEvent[]) {
            this.on(event.name, (...args: unknown[]) => event.execute(this, getClient(), ...args));
        }
    }

    loadMarkers(): void {
        const client = getClient();
        const instance = client.getInstance(this.guildId);

        for (const [name, location] of Object.entries(instance.serverList[this.serverId].markers) as [
            string,
            import('../types/instance.js').Marker,
        ][]) {
            this.markers[name] = { x: location.x, y: location.y, location: location.location };
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
        return date instanceof Date ? date.getTime() : null;
    }

    timestampToDate(timestamp: number): Date | null {
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
            return null;
        }
        return new Date(timestamp);
    }

    getTimerEndAtMs(timer: any): number | null {
        if (!timer || !timer.getStateRunning()) return null;
        const remainingMs = timer.getTimeLeft();
        if (typeof remainingMs !== 'number' || remainingMs <= 0) return null;
        return Date.now() + remainingMs;
    }

    persistCustomTimersState(): void {
        const persistedTimers: PersistedTimerData[] = [];
        for (const [id, content] of Object.entries(this.timers) as [
            string,
            { timer: Timer.Timer; message: string } | undefined,
        ][]) {
            if (!content || !content.timer || typeof content.message !== 'string') continue;

            const endAtMs = this.getTimerEndAtMs(content.timer);
            if (endAtMs === null) continue;

            persistedTimers.push({
                id: parseInt(id),
                message: content.message,
                endAtMs: endAtMs,
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
        const state = persisted as PersistedRuntimeState | null;
        if (!state || !Array.isArray(state.timers)) return;

        for (const timerData of state.timers) {
            const id = timerData.id;
            if (!Number.isInteger(id) || id < 0) continue;
            if (this.timers.hasOwnProperty(id)) continue;
            if (typeof timerData.message !== 'string' || timerData.message === '') continue;

            const endAtMs = Number(timerData.endAtMs);
            if (!Number.isFinite(endAtMs)) continue;
            const remainingMs = Math.floor(endAtMs - Date.now());
            if (remainingMs <= 0) continue;

            this.timers[id] = {
                timer: new Timer.Timer(() => {
                    const client = getClient();
                    this.sendInGameMessage(
                        client.intlGet(this.guildId, 'timer', {
                            message: timerData.message,
                        }),
                    );
                    delete this.timers[id];
                    this.persistCustomTimersState();
                }, remainingMs),
                message: timerData.message,
            };
            this.timers[id].timer.start();
        }

        this.persistCustomTimersState();
    }

    buildMapMarkersRuntimeState(): any {
        if (!this.mapMarkers) return null;

        const cargoShipEgressTimers: PersistedCargoShipEgressTimer[] = [];
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
                y: cargoShip ? cargoShip.y : null,
            });
        }

        const cargoShipsState = this.mapMarkers.cargoShips.map(
            (cargoShip: { id: number; x: number; y: number; onItsWayOut?: boolean }) => ({
                id: cargoShip.id,
                x: cargoShip.x,
                y: cargoShip.y,
                onItsWayOut: cargoShip.onItsWayOut === true,
            }),
        );

        return {
            timeSinceCargoShipWasOutMs: this.dateToTimestamp(this.mapMarkers.timeSinceCargoShipWasOut),
            timeSinceCH47WasOutMs: this.dateToTimestamp(this.mapMarkers.timeSinceCH47WasOut),
            timeSinceSmallOilRigWasTriggeredMs: this.dateToTimestamp(this.mapMarkers.timeSinceSmallOilRigWasTriggered),
            timeSinceLargeOilRigWasTriggeredMs: this.dateToTimestamp(this.mapMarkers.timeSinceLargeOilRigWasTriggered),
            timeSincePatrolHelicopterWasOnMapMs: this.dateToTimestamp(
                this.mapMarkers.timeSincePatrolHelicopterWasOnMap,
            ),
            timeSincePatrolHelicopterWasDestroyedMs: this.dateToTimestamp(
                this.mapMarkers.timeSincePatrolHelicopterWasDestroyed,
            ),
            patrolHelicopterDestroyedLocation: this.mapMarkers.patrolHelicopterDestroyedLocation,
            timeSinceTravelingVendorWasOnMapMs: this.dateToTimestamp(this.mapMarkers.timeSinceTravelingVendorWasOnMap),
            timeSinceDeepSeaSpawnedMs: this.dateToTimestamp(this.mapMarkers.timeSinceDeepSeaSpawned),
            timeSinceDeepSeaWasOnMapMs: this.dateToTimestamp(this.mapMarkers.timeSinceDeepSeaWasOnMap),
            crateSmallOilRigLocation: this.mapMarkers.crateSmallOilRigLocation,
            crateLargeOilRigLocation: this.mapMarkers.crateLargeOilRigLocation,
            crateSmallOilRigUnlockAtMs: this.getTimerEndAtMs(this.mapMarkers.crateSmallOilRigTimer),
            crateLargeOilRigUnlockAtMs: this.getTimerEndAtMs(this.mapMarkers.crateLargeOilRigTimer),
            cargoShipEgressTimers: cargoShipEgressTimers,
            cargoShipsState: cargoShipsState,
        };
    }

    persistMapMarkersRuntimeState(): void {
        const state = this.buildMapMarkersRuntimeState();
        if (state === null) return;
        this.setRuntimeState('mapMarkers', state);
    }

    restoreOilRigCrateTimerFromState(type: string, unlockAtMs: number, location: string): void {
        if (!this.mapMarkers) return;

        const safeLocation = typeof location === 'string' && location !== '' ? location : null;
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
                    [safeLocation],
                );
                this.mapMarkers.crateSmallOilRigTimer.start();
            }
        } else if (type === 'large') {
            if (this.mapMarkers.crateLargeOilRigTimer) {
                this.mapMarkers.crateLargeOilRigTimer.stop();
                this.mapMarkers.crateLargeOilRigTimer = null;
            }

            this.mapMarkers.crateLargeOilRigLocation = safeLocation;

            if (safeLocation !== null && remainingMs !== null && remainingMs > 0) {
                this.mapMarkers.crateLargeOilRigTimer = new Timer.Timer(
                    this.mapMarkers.notifyCrateLargeOilRigOpen.bind(this.mapMarkers),
                    remainingMs,
                    [safeLocation],
                );
                this.mapMarkers.crateLargeOilRigTimer.start();
            }
        }
    }

    restorePersistentRuntimeState(): void {
        if (this.persistentRuntimeStateRestored) return;
        this.restoreMapMarkersRuntimeState();
        this.restoreCustomTimersState();
        this.persistentRuntimeStateRestored = true;
    }

    restoreMapMarkersRuntimeState(): void {
        const persisted = this.getRuntimeState('mapMarkers');
        if (!persisted) return;

        const state = persisted as PersistedRuntimeState;

        if (state.timeSinceCargoShipWasOutMs) {
            this.mapMarkers.timeSinceCargoShipWasOut = this.timestampToDate(state.timeSinceCargoShipWasOutMs);
        }
        if (state.timeSinceCH47WasOutMs) {
            this.mapMarkers.timeSinceCH47WasOut = this.timestampToDate(state.timeSinceCH47WasOutMs);
        }
        if (state.timeSinceSmallOilRigWasTriggeredMs) {
            this.mapMarkers.timeSinceSmallOilRigWasTriggered = this.timestampToDate(
                state.timeSinceSmallOilRigWasTriggeredMs,
            );
        }
        if (state.timeSinceLargeOilRigWasTriggeredMs) {
            this.mapMarkers.timeSinceLargeOilRigWasTriggered = this.timestampToDate(
                state.timeSinceLargeOilRigWasTriggeredMs,
            );
        }
        if (state.timeSincePatrolHelicopterWasOnMapMs) {
            this.mapMarkers.timeSincePatrolHelicopterWasOnMap = this.timestampToDate(
                state.timeSincePatrolHelicopterWasOnMapMs,
            );
        }
        if (state.timeSincePatrolHelicopterWasDestroyedMs) {
            this.mapMarkers.timeSincePatrolHelicopterWasDestroyed = this.timestampToDate(
                state.timeSincePatrolHelicopterWasDestroyedMs,
            );
        }
        if (state.patrolHelicopterDestroyedLocation) {
            this.mapMarkers.patrolHelicopterDestroyedLocation = state.patrolHelicopterDestroyedLocation;
        }
        if (state.timeSinceTravelingVendorWasOnMapMs) {
            this.mapMarkers.timeSinceTravelingVendorWasOnMap = this.timestampToDate(
                state.timeSinceTravelingVendorWasOnMapMs,
            );
        }
        if (state.timeSinceDeepSeaSpawnedMs) {
            this.mapMarkers.timeSinceDeepSeaSpawned = this.timestampToDate(state.timeSinceDeepSeaSpawnedMs);
        }
        if (state.timeSinceDeepSeaWasOnMapMs) {
            this.mapMarkers.timeSinceDeepSeaWasOnMap = this.timestampToDate(state.timeSinceDeepSeaWasOnMapMs);
        }
        if (state.crateSmallOilRigLocation || state.crateSmallOilRigUnlockAtMs) {
            this.restoreOilRigCrateTimerFromState(
                'small',
                state.crateSmallOilRigUnlockAtMs,
                state.crateSmallOilRigLocation,
            );
        }
        if (state.crateLargeOilRigLocation || state.crateLargeOilRigUnlockAtMs) {
            this.restoreOilRigCrateTimerFromState(
                'large',
                state.crateLargeOilRigUnlockAtMs,
                state.crateLargeOilRigLocation,
            );
        }

        if (state.cargoShipEgressTimers) {
            for (const timerData of state.cargoShipEgressTimers) {
                const id = timerData.id;
                const endAtMs = timerData.endAtMs;
                const x = timerData.x;
                const y = timerData.y;

                const remainingMs = Math.floor(endAtMs - Date.now());
                if (remainingMs <= 0) continue;

                this.mapMarkers.cargoShipEgressTimers[id] = new Timer.Timer(() => {
                    this.mapMarkers.timeSinceCargoShipWasOut = new Date();
                    delete this.mapMarkers.cargoShipEgressTimers[id];
                    this.persistMapMarkersRuntimeState();
                }, remainingMs);
                this.mapMarkers.cargoShipEgressTimers[id].start();
            }
        }

        if (state.cargoShipsState) {
            for (const cargoShip of state.cargoShipsState) {
                const marker = this.mapMarkers.getMarkerByTypeId(this.mapMarkers.types.CargoShip, cargoShip.id);
                if (marker) {
                    marker.onItsWayOut = cargoShip.onItsWayOut;
                }
            }
        }
    }

    build(): void {
        const client = getClient();
        const instance = client.getInstance(this.guildId);

        this.logger = new Logger(`${this.guildId}.log`);
        this.logger.setGuildId(this.guildId);
        this.logger.serverName = instance.serverList[this.serverId].title;

        this.generalSettings = instance.generalSettings;
        this.notificationSettings = instance.notificationSettings;

        this.connect();
    }

    updateLeaderRustPlusLiteInstance(): void {
        const client = getClient();
        if (this.leaderRustPlusInstance !== null) {
            if (client.rustplusLiteReconnectTimers[this.guildId]) {
                clearTimeout(client.rustplusLiteReconnectTimers[this.guildId]);
                client.rustplusLiteReconnectTimers[this.guildId] = null;
            }
            this.leaderRustPlusInstance.isActive = false;
            this.leaderRustPlusInstance.disconnect();
            this.leaderRustPlusInstance = null;
        }

        const instance = client.getInstance(this.guildId);
        const leader = this.team.leaderSteamId;
        if (leader === this.playerId) return;
        if (!(leader in instance.serverListLite[this.serverId])) return;
        const serverLite = instance.serverListLite[this.serverId][leader];

        this.leaderRustPlusInstance = new RustPlusLite(
            this.guildId,
            this.logger,
            this,
            serverLite.serverIp,
            serverLite.appPort,
            serverLite.steamId,
            serverLite.playerToken,
        );
        this.leaderRustPlusInstance.connect();
    }

    isServerAvailable(): boolean {
        const instance = getClient().getInstance(this.guildId);
        return Object.hasOwn(instance.serverList, this.serverId);
    }

    updateConnections(steamId: string, str: string): void {
        const time = Timer.getCurrentDateTime();
        const savedString = `${time} - ${str}`;

        if (this.allConnections.length === 10) this.allConnections.pop();
        this.allConnections.unshift(savedString);

        if (!Object.hasOwn(this.playerConnections, steamId)) this.playerConnections[steamId] = [];
        if (this.playerConnections[steamId].length === 10) this.playerConnections[steamId].pop();
        this.playerConnections[steamId].unshift(savedString);
    }

    updateDeaths(steamId: string, data: any): void {
        data['time'] = Timer.getCurrentDateTime();

        if (this.allDeaths.length === 10) this.allDeaths.pop();
        this.allDeaths.unshift(data);

        if (!Object.hasOwn(this.playerDeaths, steamId)) this.playerDeaths[steamId] = [];
        if (this.playerDeaths[steamId].length === 10) this.playerDeaths[steamId].pop();
        this.playerDeaths[steamId].unshift(data);
    }

    updateEvents(event: string, message: string): void {
        const client = getClient();
        const validEvents = ['cargo', 'heli', 'small', 'large', 'chinook'].map((k) =>
            client.intlGet('en', `commandSyntax${k.charAt(0).toUpperCase() + k.slice(1)}`),
        );
        if (!validEvents.includes(event)) return;

        const str = `${Timer.getCurrentDateTime()} - ${message}`;
        if (this.events['all'].length === 10) this.events['all'].pop();
        this.events['all'].unshift(str);
        if (this.events[event] && this.events[event].length === 10) this.events[event].pop();
        if (this.events[event]) this.events[event].unshift(str);
    }

    updateBotMessages(message: string): void {
        if (this.messagesSentByBot.length === 20) this.messagesSentByBot.pop();
        this.messagesSentByBot.unshift(message);
    }

    deleteThisRustplusInstance(): boolean {
        this.isDeleted = true;
        this.disconnect();
        const client = getClient();
        if (
            Object.hasOwn(client.rustplusInstances, this.guildId) &&
            client.rustplusInstances[this.guildId].serverId === this.serverId
        ) {
            delete client.rustplusInstances[this.guildId];
            return true;
        }
        return false;
    }

    log(title: string, text: string, level = 'info'): void {
        this.logger.log(title, text, level);
    }

    logInGameCommand(type = 'Default', message: any): void {
        const client = getClient();
        this.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'logInGameCommand', {
                type,
                command: message.broadcast.teamMessage.message.message,
                user: `${message.broadcast.teamMessage.message.name} (${message.broadcast.teamMessage.message.steamId.toString()})`,
            }),
        );
    }

    sendInGameMessage(message: any): void {
        InGameChatHandler.inGameChatHandler(this, getClient(), message);
    }

    async sendEvent(
        setting: any,
        text: string,
        event: string,
        embedColor: string,
        firstPoll = false,
        image: string | null = null,
    ): Promise<void> {
        const client = getClient();
        const img = image ?? setting.image;
        this.updateEvents(event, text);
        if (!firstPoll && setting.discord)
            await DiscordMessages.sendDiscordEventMessage(this.guildId, this.serverId, text, img, embedColor);
        if (!firstPoll && setting.inGame) await this.sendInGameMessage(`${text}`);
        if (!firstPoll && setting.voice) await DiscordVoice.sendDiscordVoiceMessage(this.guildId, text);
        this.log(client.intlGet(null, 'eventCap'), text);
    }

    replenishTokens(): void {
        this.tokens = Math.min(this.tokens + TOKENS_REPLENISH, TOKENS_LIMIT);
    }

    async waitForAvailableTokens(cost: number): Promise<boolean> {
        let timeoutCounter = 0;
        while (this.tokens < cost) {
            if (timeoutCounter === 90) return false;
            await Timer.sleep(1000 / 3);
            timeoutCounter += 1;
        }
        this.tokens -= cost;
        return true;
    }

    async turnSmartSwitchAsync(id: number, value: boolean, timeout = 10000): Promise<any> {
        return value ? this.turnSmartSwitchOnAsync(id, timeout) : this.turnSmartSwitchOffAsync(id, timeout);
    }

    async turnSmartSwitchOnAsync(id: number, timeout = 10000): Promise<any> {
        try {
            return await this.setEntityValueAsync(id, true, timeout);
        } catch (e) {
            return e;
        }
    }

    async turnSmartSwitchOffAsync(id: number, timeout = 10000): Promise<any> {
        try {
            return await this.setEntityValueAsync(id, false, timeout);
        } catch (e) {
            return e;
        }
    }

    async setEntityValueAsync(id: number, value: boolean, timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ entityId: id, setEntityValue: { value } }, timeout).catch(
                (e: any) => e,
            );
        } catch (e) {
            return e;
        }
    }

    async sendTeamMessageAsync(message: string, timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(2)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ sendTeamMessage: { message } }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async getEntityInfoAsync(id: number, timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ entityId: id, getEntityInfo: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async getMapAsync(timeout = 30000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(5)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ getMap: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async getTimeAsync(timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ getTime: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async getMapMarkersAsync(timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ getMapMarkers: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async getInfoAsync(timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ getInfo: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async getTeamInfoAsync(timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ getTeamInfo: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async subscribeToCameraAsync(identifier: string, timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ cameraSubscribe: { cameraId: identifier } }, timeout).catch(
                (e: any) => e,
            );
        } catch (e) {
            return e;
        }
    }

    async unsubscribeFromCameraAsync(timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ cameraUnsubscribe: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async sendCameraInputAsync(buttons: any, x: number, y: number, timeout = 1000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(0.01)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ cameraInput: { buttons, mouseDelta: { x, y } } }, timeout).catch(
                (e: any) => e,
            );
        } catch (e) {
            return e;
        }
    }

    async promoteToLeaderAsync(steamId: string, timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ promoteToLeader: { steamId } }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async getTeamChatAsync(timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ getTeamChat: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async checkSubscriptionAsync(id: number, timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ entityId: id, checkSubscription: {} }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async setSubscriptionAsync(id: number, value: boolean, timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(1)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ entityId: id, setSubscription: { value } }, timeout).catch(
                (e: any) => e,
            );
        } catch (e) {
            return e;
        }
    }

    async getCameraFrameAsync(identifier: string, frame: number, timeout = 10000): Promise<any> {
        try {
            if (!(await this.waitForAvailableTokens(2)))
                return { error: getClient().intlGet(null, 'tokensDidNotReplenish') };
            return await this.sendRequestAsync({ getCameraFrame: { identifier, frame } }, timeout).catch((e: any) => e);
        } catch (e) {
            return e;
        }
    }

    async isResponseValid(response: any): Promise<boolean> {
        const client = getClient();
        if (response === undefined) {
            this.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'responseIsUndefined'), 'error');
            return false;
        } else if (response.toString() === 'Error: Timeout reached while waiting for response') {
            this.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'responseTimeout'), 'error');
            return false;
        } else if (Object.hasOwn(response, 'error')) {
            this.log(
                client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'responseContainError', { error: JSON.stringify(response) }),
                'error',
            );
            return false;
        } else if (Object.keys(response).length === 0) {
            this.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'responseIsEmpty'), 'error');
            clearInterval(this.pollingTaskId);
            return false;
        }
        return true;
    }

    /* In-game commands */

    getCommandAfk(): string {
        const client = getClient();
        let str = '';
        for (const player of this.team.players) {
            if (player.isOnline && player.getAfkSeconds() >= 300) {
                str += `${player.name} [${player.getAfkTime('dhs')}], `;
            }
        }
        return str !== '' ? `${str.slice(0, -2)}.` : client.intlGet(this.guildId, 'noOneIsAfk');
    }

    getCommandAlive(command: string): string | null {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdAlive = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxAlive')}`;
        const cmdAliveEn = `${prefix}${client.intlGet('en', 'commandSyntaxAlive')}`;
        const lc = command.toLowerCase();

        if (lc === cmdAlive || lc === cmdAliveEn) {
            const player = this.team.getPlayerLongestAlive();
            return client.intlGet(this.guildId, 'hasBeenAliveLongest', {
                name: player.name,
                time: player.getAliveTime(),
            });
        }

        let name: string | null = null;
        if (lc.startsWith(`${cmdAlive} `)) name = command.slice(`${cmdAlive} `.length).trim();
        else if (lc.startsWith(`${cmdAliveEn} `)) name = command.slice(`${cmdAliveEn} `.length).trim();
        if (!name) return null;

        for (const player of this.team.players) {
            if (player.name.includes(name)) {
                return client.intlGet(this.guildId, 'playerHasBeenAliveFor', {
                    name: player.name,
                    time: player.getAliveTime(),
                });
            }
        }
        return client.intlGet(this.guildId, 'couldNotFindTeammate', { name });
    }

    getCommandCargo(isInfoChannel = false): any {
        const client = getClient();
        const strings: string[] = [];
        let unhandled = this.mapMarkers.cargoShips.map((e: any) => e.id);

        for (const [id, timer] of Object.entries(this.mapMarkers.cargoShipEgressTimers)) {
            const cargoShip = this.mapMarkers.getMarkerByTypeId(this.mapMarkers.types.CargoShip, parseInt(id));
            const time = Timer.getTimeLeftOfTimer(timer as any);
            if (time) {
                if (isInfoChannel)
                    return client.intlGet(this.guildId, 'egressInTime', {
                        time: Timer.getTimeLeftOfTimer(timer as any, 's'),
                        location: cargoShip.location.string,
                    });
                strings.push(
                    client.intlGet(this.guildId, 'timeBeforeCargoEntersEgress', {
                        time,
                        location: cargoShip.location.string,
                    }),
                );
            }
            unhandled = unhandled.filter((e: any) => e !== parseInt(id));
        }

        for (const id of unhandled) {
            const cargoShip = this.mapMarkers.getMarkerByTypeId(this.mapMarkers.types.CargoShip, id);
            const key = cargoShip.onItsWayOut
                ? isInfoChannel
                    ? 'leavingMapAt'
                    : 'cargoLeavingMapAt'
                : isInfoChannel
                  ? 'cargoAt'
                  : 'cargoLocatedAt';
            if (isInfoChannel) return client.intlGet(this.guildId, key, { location: cargoShip.location.string });
            strings.push(client.intlGet(this.guildId, key, { location: cargoShip.location.string }));
        }

        if (strings.length === 0) {
            if (this.mapMarkers.timeSinceCargoShipWasOut === null) {
                return isInfoChannel
                    ? client.intlGet(this.guildId, 'notActive')
                    : client.intlGet(this.guildId, 'cargoNotCurrentlyOnMap');
            }
            const secondsSince = (Date.now() - this.mapMarkers.timeSinceCargoShipWasOut.getTime()) / 1000;
            const time = Timer.secondsToFullScale(secondsSince, isInfoChannel ? 's' : '');
            return isInfoChannel
                ? client.intlGet(this.guildId, 'timeSinceLast', { time })
                : client.intlGet(this.guildId, 'timeSinceCargoLeft', { time });
        }
        return strings;
    }

    getCommandChinook(isInfoChannel = false): any {
        const client = getClient();
        const strings: string[] = [];
        for (const ch47 of this.mapMarkers.ch47s) {
            if (ch47.ch47Type === 'crate') {
                if (isInfoChannel)
                    return client.intlGet(this.guildId, 'atLocation', { location: ch47.location.string });
                strings.push(client.intlGet(this.guildId, 'chinook47Located', { location: ch47.location.string }));
            }
        }

        if (strings.length === 0) {
            if (this.mapMarkers.timeSinceCH47WasOut === null) {
                return isInfoChannel
                    ? client.intlGet(this.guildId, 'notActive')
                    : client.intlGet(this.guildId, 'chinook47NotOnMap');
            }
            const secondsSince = (Date.now() - this.mapMarkers.timeSinceCH47WasOut.getTime()) / 1000;
            const time = Timer.secondsToFullScale(secondsSince, isInfoChannel ? 's' : '');
            if (isInfoChannel) return client.intlGet(this.guildId, 'timeSinceLast', { time });
            strings.push(client.intlGet(this.guildId, 'timeSinceChinook47OnMap', { time }));
        }
        return strings;
    }

    getCommandConnection(command: string): any {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdConn = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxConnection')}`;
        const cmdConnEn = `${prefix}${client.intlGet('en', 'commandSyntaxConnection')}`;
        const cmdConns = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxConnections')}`;
        const cmdConnsEn = `${prefix}${client.intlGet('en', 'commandSyntaxConnections')}`;
        const lc = command.toLowerCase();

        if (lc.startsWith(cmdConns) || lc.startsWith(cmdConnsEn)) {
            const rest = lc.startsWith(cmdConns)
                ? command.slice(cmdConns.length).trim()
                : command.slice(cmdConnsEn.length).trim();
            const number = parseInt(rest);
            if (this.allConnections.length === 0) return client.intlGet(this.guildId, 'noRegisteredConnectionEvents');
            const strings: string[] = [];
            let counter = 1;
            for (const event of this.allConnections) {
                if (counter === 6) break;
                if (number === counter) return event;
                strings.push(event);
                counter++;
            }
            return strings;
        }

        if (lc.startsWith(`${cmdConn} `) || lc.startsWith(`${cmdConnEn} `)) {
            const rest = lc.startsWith(`${cmdConn} `)
                ? command.slice(`${cmdConn} `.length).trim()
                : command.slice(`${cmdConnEn} `.length).trim();
            const name = rest.replace(/ .*/, '');
            const number = parseInt(rest.slice(name.length + 1));
            for (const player of this.team.players) {
                if (player.name.includes(name)) {
                    if (!Object.hasOwn(this.playerConnections, player.steamId))
                        this.playerConnections[player.steamId] = [];
                    if (this.playerConnections[player.steamId].length === 0)
                        return client.intlGet(this.guildId, 'noRegisteredConnectionEventsUser', { user: player.name });
                    const strings: string[] = [];
                    let counter = 1;
                    for (const event of this.playerConnections[player.steamId]) {
                        if (counter === 6) break;
                        if (number === counter) return event;
                        strings.push(event);
                        counter++;
                    }
                    return strings;
                }
            }
            return client.intlGet(this.guildId, 'couldNotFindTeammate', { name });
        }
        return null;
    }

    getCommandCraft(command: string): string {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdCraft = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxCraft')}`;
        const cmdCraftEn = `${prefix}${client.intlGet('en', 'commandSyntaxCraft')}`;
        const rest = command.toLowerCase().startsWith(`${cmdCraft} `)
            ? command.slice(`${cmdCraft} `.length).trim()
            : command.slice(`${cmdCraftEn} `.length).trim();

        const words = rest.split(' ');
        const lastWord = words[words.length - 1];
        const isNum = !isNaN(lastWord as any);
        const itemName = isNum ? rest.slice(0, -lastWord.length).trim() : rest;
        const quantity = isNum ? parseInt(lastWord) : 1;

        const itemId = client.items.getClosestItemIdByName(itemName);
        if (!itemId || itemName === '') return client.intlGet(this.guildId, 'noItemWithNameFound', { name: itemName });

        const name = client.items.getName(itemId);
        const craftDetails = client.rustlabs.getCraftDetailsById(itemId);
        if (!craftDetails) return client.intlGet(this.guildId, 'couldNotFindCraftDetails', { name });

        const d = craftDetails[2];
        const timeStr = quantity === 1 ? d.timeString : Timer.secondsToFullScale(d.time * quantity, '', true);
        let str = `${name} x${quantity} (${timeStr}): `;
        for (const ingredient of d.ingredients) {
            str += `${client.items.getName(ingredient.id)} x${ingredient.quantity * quantity}, `;
        }
        return str.slice(0, -2);
    }

    async getCommandDeath(command: string, callerSteamId: string): Promise<any> {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdDeath = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxDeath')}`;
        const cmdDeathEn = `${prefix}${client.intlGet('en', 'commandSyntaxDeath')}`;
        const cmdDeaths = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxDeaths')}`;
        const cmdDeathsEn = `${prefix}${client.intlGet('en', 'commandSyntaxDeaths')}`;
        const lc = command.toLowerCase();

        const teamInfo = await this.getTeamInfoAsync();
        if (!(await this.isResponseValid(teamInfo))) return null;
        TeamHandler.handler(this, client, teamInfo.teamInfo);
        this.team.updateTeam(teamInfo.teamInfo);
        const caller = this.team.getPlayer(callerSteamId);

        const buildDeathStr = (event: any) => {
            if (!event.location) return client.intlGet(this.guildId, 'unknown');
            const dist = Math.floor(GameMap.getDistance(caller.x, caller.y, event.location.x, event.location.y));
            const dir = GameMap.getAngleBetweenPoints(caller.x, caller.y, event.location.x, event.location.y);
            return client.intlGet(this.guildId, 'distanceDirectionGrid', {
                distance: dist,
                direction: dir,
                grid: event.location.location,
            });
        };

        if (lc.startsWith(cmdDeaths) || lc.startsWith(cmdDeathsEn)) {
            const rest = lc.startsWith(cmdDeaths)
                ? command.slice(cmdDeaths.length).trim()
                : command.slice(cmdDeathsEn.length).trim();
            const number = parseInt(rest);
            if (this.allDeaths.length === 0) return client.intlGet(this.guildId, 'noRegisteredDeathEvents');
            const strings: string[] = [];
            let counter = 1;
            for (const event of this.allDeaths) {
                if (counter === 6) break;
                const str = `${event.time} - ${event.name}: ${buildDeathStr(event)}`;
                if (counter === number) return str;
                strings.push(str);
                counter++;
            }
            return strings;
        }

        const rest = lc.startsWith(`${cmdDeath} `)
            ? command.slice(`${cmdDeath} `.length).trim()
            : command.slice(`${cmdDeathEn} `.length).trim();
        const name = rest.replace(/ .*/, '');
        const number = parseInt(rest.slice(name.length + 1));
        for (const player of this.team.players) {
            if (player.name.includes(name)) {
                if (!Object.hasOwn(this.playerDeaths, player.steamId)) this.playerDeaths[player.steamId] = [];
                if (this.playerDeaths[player.steamId].length === 0)
                    return client.intlGet(this.guildId, 'noRegisteredDeathEventsUser', { user: player.name });
                const strings: string[] = [];
                let counter = 1;
                for (const event of this.playerDeaths[player.steamId]) {
                    if (counter === 6) break;
                    const str = `${event.time} - ${buildDeathStr(event)}`;
                    if (counter === number) return str;
                    strings.push(str);
                    counter++;
                }
                return strings;
            }
        }
        return client.intlGet(this.guildId, 'couldNotIdentifyMember', { name });
    }

    getCommandDecay(command: string): string {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdDecay = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxDecay')}`;
        const cmdDecayEn = `${prefix}${client.intlGet('en', 'commandSyntaxDecay')}`;
        const rest = command.toLowerCase().startsWith(`${cmdDecay} `)
            ? command.slice(`${cmdDecay} `.length).trim()
            : command.slice(`${cmdDecayEn} `.length).trim();

        const words = rest.split(' ');
        const lastWord = words[words.length - 1];
        const isNum = !isNaN(lastWord as any) && lastWord !== '';
        const itemInput = isNum ? rest.slice(0, -lastWord.length).trim() : rest;
        const itemHp = isNum ? parseInt(lastWord) : null;

        let type = 'items';
        let foundId: string | null = null;

        foundId = client.rustlabs.getClosestOtherNameByName(itemInput);
        if (foundId && client.rustlabs.decayData.hasEntry(foundId, 'other')) {
            type = 'other';
        } else {
            foundId = client.rustlabs.getClosestBuildingBlockNameByName(itemInput);
            if (foundId && client.rustlabs.decayData.hasEntry(foundId, 'buildingBlocks')) {
                type = 'buildingBlocks';
            } else {
                foundId = client.items.getClosestItemIdByName(itemInput);
                if (foundId && !client.rustlabs.decayData.hasEntry(foundId, 'items')) foundId = null;
            }
        }

        if (!foundId) return client.intlGet(this.guildId, 'noItemWithNameFound', { name: itemInput });

        const itemName = type === 'items' ? client.items.getName(foundId) : foundId;
        const decayDetails =
            type === 'items'
                ? client.rustlabs.getDecayDetailsById(foundId)
                : client.rustlabs.getDecayDetailsByName(foundId);
        if (!decayDetails) return client.intlGet(this.guildId, 'couldNotFindDecayDetails', { name: itemName });

        const d = decayDetails[3];
        const hp = itemHp ?? d.hp;
        if (hp > d.hp) return client.intlGet(this.guildId, 'hpExceedMax', { hp, max: d.hp });

        const mult = hp / d.hp;
        let str = `${itemName} (${hp}/${d.hp}) `;
        const parts: string[] = [];
        const addPart = (key: string, label: string, timeKey: string) => {
            if (d[key] === null) return;
            const timeStr = hp === d.hp ? d[key] : Timer.secondsToFullScale(Math.floor(d[timeKey] * mult));
            parts.push(`${client.intlGet(this.guildId, label)}: ${timeStr}`);
        };
        addPart('decayString', 'decay', 'decay');
        addPart('decayOutsideString', 'outside', 'decayOutside');
        addPart('decayInsideString', 'inside', 'decayInside');
        addPart('decayUnderwaterString', 'underwater', 'decayUnderwater');
        str += `${parts.join(', ')}.`;
        return str;
    }

    getCommandDespawn(command: string): string {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdDespawn = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxDespawn')}`;
        const cmdDespawnEn = `${prefix}${client.intlGet('en', 'commandSyntaxDespawn')}`;
        const rest = command.toLowerCase().startsWith(`${cmdDespawn} `)
            ? command.slice(`${cmdDespawn} `.length).trim()
            : command.slice(`${cmdDespawnEn} `.length).trim();

        const itemId = client.items.getClosestItemIdByName(rest);
        if (!itemId) return client.intlGet(this.guildId, 'noItemWithNameFound', { name: rest });
        const itemName = client.items.getName(itemId);
        const details = client.rustlabs.getDespawnDetailsById(itemId);
        if (!details) return client.intlGet(this.guildId, 'couldNotFindDespawnDetails', { name: itemName });
        return client.intlGet(this.guildId, 'despawnTimeOfItem', { item: itemName, time: details[2].timeString });
    }

    getCommandEvents(command: string): any {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdEvents = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxEvents')}`;
        const cmdEventsEn = `${prefix}${client.intlGet('en', 'commandSyntaxEvents')}`;

        const eventKeyMap: Record<string, string> = {
            [client.intlGet(this.guildId, 'commandSyntaxCargo')]: 'cargo',
            [client.intlGet('en', 'commandSyntaxCargo')]: 'cargo',
            [client.intlGet(this.guildId, 'commandSyntaxHeli')]: 'heli',
            [client.intlGet('en', 'commandSyntaxHeli')]: 'heli',
            [client.intlGet(this.guildId, 'commandSyntaxSmall')]: 'small',
            [client.intlGet('en', 'commandSyntaxSmall')]: 'small',
            [client.intlGet(this.guildId, 'commandSyntaxLarge')]: 'large',
            [client.intlGet('en', 'commandSyntaxLarge')]: 'large',
            [client.intlGet(this.guildId, 'commandSyntaxChinook')]: 'chinook',
            [client.intlGet('en', 'commandSyntaxChinook')]: 'chinook',
        };

        const rest = command.toLowerCase().startsWith(`${cmdEvents}`)
            ? command.slice(cmdEvents.length).trim()
            : command.slice(cmdEventsEn.length).trim();

        const token = rest.replace(/ .*/, '').toLowerCase();
        let event = eventKeyMap[token] ?? 'all';
        let count = parseInt(rest.slice(token.length).trim());
        if (isNaN(count)) {
            if (!eventKeyMap[token] && token !== '') {
                event = 'all';
                count = parseInt(token);
            }
            if (isNaN(count)) count = 5;
        }

        const strings = this.events[event]?.slice(0, count) ?? [];
        return strings.length > 0 ? strings : client.intlGet(this.guildId, 'noRegisteredEvents');
    }

    getCommandHeli(isInfoChannel = false): any {
        const client = getClient();
        const strings: string[] = [];
        for (const heli of this.mapMarkers.patrolHelicopters) {
            if (isInfoChannel) return client.intlGet(this.guildId, 'atLocation', { location: heli.location.string });
            strings.push(client.intlGet(this.guildId, 'patrolHelicopterLocatedAt', { location: heli.location.string }));
        }

        if (strings.length === 0) {
            const wasOnMap = this.mapMarkers.timeSincePatrolHelicopterWasOnMap;
            const wasDestroyed = this.mapMarkers.timeSincePatrolHelicopterWasDestroyed;

            if (!wasOnMap && !wasDestroyed) {
                return isInfoChannel
                    ? client.intlGet(this.guildId, 'notActive')
                    : client.intlGet(this.guildId, 'patrolHelicopterNotCurrentlyOnMap');
            } else if (wasOnMap && !wasDestroyed) {
                const time = Timer.secondsToFullScale(
                    (Date.now() - wasOnMap.getTime()) / 1000,
                    isInfoChannel ? 's' : '',
                );
                return isInfoChannel
                    ? client.intlGet(this.guildId, 'timeSinceLast', { time })
                    : client.intlGet(this.guildId, 'timeSincePatrolHelicopterWasOnMap', { time });
            } else if (wasOnMap && wasDestroyed) {
                const t1 = Timer.secondsToFullScale((Date.now() - wasOnMap.getTime()) / 1000, isInfoChannel ? 's' : '');
                const t2 = Timer.secondsToFullScale(
                    (Date.now() - wasDestroyed.getTime()) / 1000,
                    isInfoChannel ? 's' : '',
                );
                const loc = this.mapMarkers.patrolHelicopterDestroyedLocation
                    ? ` [${this.mapMarkers.patrolHelicopterDestroyedLocation}]`
                    : '';
                const key = isInfoChannel ? 'timeSinceLastSinceDestroyedShort' : 'timeSinceLastSinceDestroyedLong';
                return client.intlGet(this.guildId, key, { time1: t1, time2: t2, location: loc });
            }
        }
        return strings;
    }

    getCommandLarge(isInfoChannel = false): any {
        const client = getClient();
        const strings: string[] = [];
        if (this.mapMarkers.crateLargeOilRigTimer) {
            const time = Timer.getTimeLeftOfTimer(this.mapMarkers.crateLargeOilRigTimer);
            if (time) {
                if (isInfoChannel)
                    return client.intlGet(this.guildId, 'timeUntilUnlocksAt', {
                        time: Timer.getTimeLeftOfTimer(this.mapMarkers.crateLargeOilRigTimer, 's'),
                        location: this.mapMarkers.crateLargeOilRigLocation,
                    });
                strings.push(
                    client.intlGet(this.guildId, 'timeBeforeCrateAtLargeOilRigUnlocks', {
                        time,
                        location: this.mapMarkers.crateLargeOilRigLocation,
                    }),
                );
            }
        }
        if (strings.length === 0) {
            if (!this.mapMarkers.timeSinceLargeOilRigWasTriggered) {
                return isInfoChannel
                    ? client.intlGet(this.guildId, 'noData')
                    : client.intlGet(this.guildId, 'noDataOnLargeOilRig');
            }
            const time = Timer.secondsToFullScale(
                (Date.now() - this.mapMarkers.timeSinceLargeOilRigWasTriggered.getTime()) / 1000,
                isInfoChannel ? 's' : '',
            );
            return isInfoChannel
                ? client.intlGet(this.guildId, 'timeSinceLastEvent', { time })
                : client.intlGet(this.guildId, 'timeSinceHeavyScientistsOnLarge', { time });
        }
        return strings;
    }

    async getCommandLeader(command: string, callerSteamId: string): Promise<string | null> {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdLeader = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxLeader')}`;
        const cmdLeaderEn = `${prefix}${client.intlGet('en', 'commandSyntaxLeader')}`;
        const lc = command.toLowerCase();

        if (!this.generalSettings.leaderCommandEnabled) return client.intlGet(this.guildId, 'leaderCommandIsDisabled');

        const instance = client.getInstance(this.guildId);
        if (!Object.keys(instance.serverListLite[this.serverId]).includes(this.team.leaderSteamId)) {
            const names = this.team.players
                .filter((p: any) => Object.keys(instance.serverListLite[this.serverId]).includes(p.steamId))
                .map((p: any) => p.name)
                .join(', ');
            return client.intlGet(this.guildId, 'leaderCommandOnlyWorks', { name: names });
        }

        const transferLeader = async (targetSteamId: string) => {
            if (this.team.leaderSteamId === this.playerId) {
                await this.team.changeLeadership(targetSteamId);
            } else {
                this.leaderRustPlusInstance.promoteToLeaderAsync(targetSteamId);
            }
        };

        if (lc === cmdLeader || lc === cmdLeaderEn) {
            if (!callerSteamId) return null;
            if (this.team.leaderSteamId === callerSteamId) return client.intlGet(this.guildId, 'youAreAlreadyLeader');
            if (
                this.generalSettings.leaderCommandOnlyForPaired &&
                !Object.keys(instance.serverListLite[this.serverId]).includes(callerSteamId)
            ) {
                return client.intlGet(this.guildId, 'youAreNotPairedWithServer');
            }
            await transferLeader(callerSteamId);
            return client.intlGet(this.guildId, 'leaderTransferred', { name: this.team.getPlayer(callerSteamId).name });
        }

        const name = lc.startsWith(`${cmdLeader} `)
            ? command.slice(`${cmdLeader} `.length).trim()
            : command.slice(`${cmdLeaderEn} `.length).trim();
        for (const player of this.team.players) {
            if (player.name.includes(name)) {
                if (this.team.leaderSteamId === player.steamId)
                    return client.intlGet(this.guildId, 'leaderAlreadyLeader', { name: player.name });
                if (
                    this.generalSettings.leaderCommandOnlyForPaired &&
                    !Object.keys(instance.serverListLite[this.serverId]).includes(player.steamId)
                ) {
                    return client.intlGet(this.guildId, 'playerNotPairedWithServer', { name: player.name });
                }
                await transferLeader(player.steamId);
                return client.intlGet(this.guildId, 'leaderTransferred', { name: player.name });
            }
        }
        return client.intlGet(this.guildId, 'couldNotIdentifyMember', { name });
    }

    async getCommandMarker(command: string, callerSteamId: string): Promise<string | null> {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdMarker = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxMarker')}`;
        const cmdMarkerEn = `${prefix}${client.intlGet('en', 'commandSyntaxMarker')}`;
        const cmdMarkers = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxMarkers')}`;
        const cmdMarkersEn = `${prefix}${client.intlGet('en', 'commandSyntaxMarkers')}`;
        const cmdAdd = client.intlGet(this.guildId, 'commandSyntaxAdd');
        const cmdAddEn = client.intlGet('en', 'commandSyntaxAdd');
        const cmdRemove = client.intlGet(this.guildId, 'commandSyntaxRemove');
        const cmdRemoveEn = client.intlGet('en', 'commandSyntaxRemove');
        const lc = command.toLowerCase();

        if (lc === cmdMarkers || lc === cmdMarkersEn) {
            const parts = Object.entries(this.markers).map(([n, m]: any) => `${n} [${m.location}]`);
            return parts.length > 0 ? parts.join(', ') : client.intlGet(this.guildId, 'noRegisteredMarkers');
        }

        const rest = lc.startsWith(`${cmdMarker} `)
            ? command.slice(`${cmdMarker} `.length).trim()
            : command.slice(`${cmdMarkerEn} `.length).trim();
        const subcommand = rest.replace(/ .*/, '');
        const name = rest.slice(subcommand.length + 1);

        if (subcommand.toLowerCase() === cmdAdd.toLowerCase() || subcommand.toLowerCase() === cmdAddEn.toLowerCase()) {
            if (!name) return null;
            const teamInfo = await this.getTeamInfoAsync();
            if (!(await this.isResponseValid(teamInfo))) return null;
            for (const player of teamInfo.teamInfo.members) {
                if (player.steamId.toString() === callerSteamId) {
                    const instance = client.getInstance(this.guildId);
                    const location = GameMap.getPos(player.x, player.y, this.info.correctedMapSize, this);
                    instance.serverList[this.serverId].markers[name] = {
                        x: player.x,
                        y: player.y,
                        location: location.location,
                    };
                    client.setInstance(this.guildId, instance);
                    this.markers[name] = { x: player.x, y: player.y, location: location.location };
                    return client.intlGet(this.guildId, 'markerAdded', { name, location: location.location });
                }
            }
        } else if (
            subcommand.toLowerCase() === cmdRemove.toLowerCase() ||
            subcommand.toLowerCase() === cmdRemoveEn.toLowerCase()
        ) {
            if (!(name in this.markers)) return client.intlGet(this.guildId, 'markerDoesNotExist', { name });
            const location = this.markers[name].location;
            const instance = client.getInstance(this.guildId);
            delete this.markers[name];
            delete instance.serverList[this.serverId].markers[name];
            client.setInstance(this.guildId, instance);
            return client.intlGet(this.guildId, 'markerRemoved', { name, location });
        } else {
            if (!(rest in this.markers)) return client.intlGet(this.guildId, 'markerDoesNotExist', { name: rest });
            const teamInfo = await this.getTeamInfoAsync();
            if (!(await this.isResponseValid(teamInfo))) return null;
            for (const player of teamInfo.teamInfo.members) {
                if (player.steamId.toString() === callerSteamId) {
                    const m = this.markers[rest];
                    const dir = GameMap.getAngleBetweenPoints(player.x, player.y, m.x, m.y);
                    const dist = Math.floor(GameMap.getDistance(player.x, player.y, m.x, m.y));
                    return client.intlGet(this.guildId, 'markerLocation', {
                        name: rest,
                        location: m.location,
                        distance: dist,
                        player: player.name,
                        direction: dir,
                    });
                }
            }
        }
        return null;
    }

    getCommandMarket(command: string): string | null {
        const client = getClient();
        const instance = client.getInstance(this.guildId);
        const prefix = this.generalSettings.prefix;
        const cmdMarket = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxMarket')}`;
        const cmdMarketEn = `${prefix}${client.intlGet('en', 'commandSyntaxMarket')}`;
        const cmdSearch = client.intlGet(this.guildId, 'commandSyntaxSearch');
        const cmdSearchEn = client.intlGet('en', 'commandSyntaxSearch');
        const cmdSub = client.intlGet(this.guildId, 'commandSyntaxSubscribe');
        const cmdSubEn = client.intlGet('en', 'commandSyntaxSubscribe');
        const cmdUnsub = client.intlGet(this.guildId, 'commandSyntaxUnsubscribe');
        const cmdUnsubEn = client.intlGet('en', 'commandSyntaxUnsubscribe');
        const cmdList = client.intlGet(this.guildId, 'commandSyntaxList');
        const cmdListEn = client.intlGet('en', 'commandSyntaxList');

        const rest = command.toLowerCase().startsWith(`${cmdMarket} `)
            ? command.slice(`${cmdMarket} `.length).trim()
            : command.slice(`${cmdMarketEn} `.length).trim();
        const subcommand = rest.replace(/ .*/, '');
        const args = rest.slice(subcommand.length + 1);
        const orderType = args.replace(/ .*/, '');
        const name = args.slice(orderType.length + 1);

        const validOrders = ['all', 'buy', 'sell'];
        const resolveItem = (n: string) => {
            const itemId = client.items.getClosestItemIdByName(n);
            if (!itemId) return { err: client.intlGet(this.guildId, 'noItemWithNameFound', { name: n }) };
            return { itemId, itemName: client.items.getName(itemId) };
        };

        const sub = subcommand.toLowerCase();
        if (sub === cmdSearch.toLowerCase() || sub === cmdSearchEn.toLowerCase()) {
            if (!validOrders.includes(orderType))
                return client.intlGet(this.guildId, 'notAValidOrderType', { order: orderType });
            const r = resolveItem(name);
            if (r.err) return r.err;
            const locations: string[] = [];
            for (const vm of this.mapMarkers.vendingMachines) {
                if (!vm.sellOrders) continue;
                for (const order of vm.sellOrders) {
                    if (order.amountInStock === 0) continue;
                    const oi = Object.hasOwn(client.items.items, order.itemId.toString()) ? order.itemId : null;
                    const ci = Object.hasOwn(client.items.items, order.currencyId.toString()) ? order.currencyId : null;
                    const match =
                        (orderType === 'all' && (oi === parseInt(r.itemId) || ci === parseInt(r.itemId))) ||
                        (orderType === 'buy' && ci === parseInt(r.itemId)) ||
                        (orderType === 'sell' && oi === parseInt(r.itemId));
                    if (match && !locations.includes(vm.location.location)) locations.push(vm.location.location);
                }
            }
            return locations.length > 0 ? locations.join(', ') : client.intlGet(this.guildId, 'noItemFound');
        } else if (sub === cmdSub.toLowerCase() || sub === cmdSubEn.toLowerCase()) {
            if (!validOrders.includes(orderType))
                return client.intlGet(this.guildId, 'notAValidOrderType', { order: orderType });
            const r = resolveItem(name);
            if (r.err) return r.err;
            if (instance.marketSubscriptionList[orderType].includes(r.itemId))
                return client.intlGet(this.guildId, 'alreadySubscribedToItem', { name: r.itemName });
            instance.marketSubscriptionList[orderType].push(r.itemId);
            this.firstPollItems[orderType].push(r.itemId);
            client.setInstance(this.guildId, instance);
            return client.intlGet(this.guildId, 'justSubscribedToItem', { name: r.itemName });
        } else if (sub === cmdUnsub.toLowerCase() || sub === cmdUnsubEn.toLowerCase()) {
            if (!validOrders.includes(orderType))
                return client.intlGet(this.guildId, 'notAValidOrderType', { order: orderType });
            const r = resolveItem(name);
            if (r.err) return r.err;
            if (!instance.marketSubscriptionList[orderType].includes(r.itemId))
                return client.intlGet(this.guildId, 'notExistInSubscription', { name: r.itemName });
            instance.marketSubscriptionList[orderType] = instance.marketSubscriptionList[orderType].filter(
                (e: any) => e !== r.itemId,
            );
            client.setInstance(this.guildId, instance);
            return client.intlGet(this.guildId, 'removedSubscribeItem', { name: r.itemName });
        } else if (sub === cmdList.toLowerCase() || sub === cmdListEn.toLowerCase()) {
            const parts: string[] = [];
            for (const [ot, ids] of Object.entries(instance.marketSubscriptionList) as [string, any[]][]) {
                if (ids.length === 0) continue;
                parts.push(
                    `${client.intlGet(this.guildId, ot)}: ${ids.map((id: any) => `${client.items.getName(id)} (${id})`).join(', ')}`,
                );
            }
            return parts.length > 0 ? parts.join(' ') : client.intlGet(this.guildId, 'subscriptionListEmpty');
        }
        return null;
    }

    getCommandMute(): string {
        const client = getClient();
        const instance = client.getInstance(this.guildId);
        instance.generalSettings.muteInGameBotMessages = true;
        this.generalSettings.muteInGameBotMessages = true;
        client.setInstance(this.guildId, instance);
        return client.intlGet(this.guildId, 'inGameBotMessagesMuted');
    }

    getCommandNote(command: string): any {
        const client = getClient();
        const instance = client.getInstance(this.guildId);
        const prefix = this.generalSettings.prefix;
        const cmdNote = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxNote')}`;
        const cmdNoteEn = `${prefix}${client.intlGet('en', 'commandSyntaxNote')}`;
        const cmdNotes = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxNotes')}`;
        const cmdNotesEn = `${prefix}${client.intlGet('en', 'commandSyntaxNotes')}`;
        const cmdAdd = client.intlGet(this.guildId, 'commandSyntaxAdd');
        const cmdAddEn = client.intlGet('en', 'commandSyntaxAdd');
        const cmdRemove = client.intlGet(this.guildId, 'commandSyntaxRemove');
        const cmdRemoveEn = client.intlGet('en', 'commandSyntaxRemove');
        const lc = command.toLowerCase();

        if (lc === cmdNotes || lc === cmdNotesEn) {
            const notes = instance.serverList[this.serverId].notes;
            if (Object.keys(notes).length === 0) return client.intlGet(this.guildId, 'noSavedNotes');
            return Object.entries(notes).map(([id, note]) => `${id}: ${note}`);
        }

        const rest = lc.startsWith(`${cmdNote} `)
            ? command.slice(`${cmdNote} `.length).trim()
            : command.slice(`${cmdNoteEn} `.length).trim();
        const subcommand = rest.replace(/ .*/, '');
        const value = rest.slice(subcommand.length + 1);

        if (subcommand.toLowerCase() === cmdAdd.toLowerCase() || subcommand.toLowerCase() === cmdAddEn.toLowerCase()) {
            let index = 0;
            while (Object.keys(instance.serverList[this.serverId].notes).map(Number).includes(index)) index++;
            instance.serverList[this.serverId].notes[index] = value;
            client.setInstance(this.guildId, instance);
            return client.intlGet(this.guildId, 'noteSaved');
        } else if (
            subcommand.toLowerCase() === cmdRemove.toLowerCase() ||
            subcommand.toLowerCase() === cmdRemoveEn.toLowerCase()
        ) {
            const id = parseInt(value.trim());
            if (isNaN(id)) return client.intlGet(this.guildId, 'noteIdInvalid');
            if (!Object.keys(instance.serverList[this.serverId].notes).map(Number).includes(id))
                return client.intlGet(this.guildId, 'noteIdDoesNotExist', { id });
            delete instance.serverList[this.serverId].notes[id];
            client.setInstance(this.guildId, instance);
            return client.intlGet(this.guildId, 'noteIdWasRemoved', { id });
        }
        return null;
    }

    getCommandOffline(): string {
        const client = getClient();
        const offline = this.team.players.filter((p: any) => !p.isOnline);
        const amount = `(${offline.length}/${this.team.players.length}) `;
        const names = offline.map((p: any) => p.name).join(', ');
        return names ? `${amount}${names}.` : `${amount}${client.intlGet(this.guildId, 'noOneIsOffline')}`;
    }

    getCommandOnline(): string {
        const client = getClient();
        const online = this.team.players.filter((p: any) => p.isOnline);
        const amount = `(${online.length}/${this.team.players.length}) `;
        const names = online.map((p: any) => p.name).join(', ');
        return names ? `${amount}${names}.` : `${amount}${client.intlGet(this.guildId, 'noOneIsOnline')}`;
    }

    getCommandPlayer(command: string): string | null {
        const client = getClient();
        const instance = client.getInstance(this.guildId);
        const battlemetricsId = instance.serverList[this.serverId].battlemetricsId;
        const prefix = this.generalSettings.prefix;
        const cmdPlayer = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxPlayer')}`;
        const cmdPlayerEn = `${prefix}${client.intlGet('en', 'commandSyntaxPlayer')}`;
        const cmdPlayers = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxPlayers')}`;
        const cmdPlayersEn = `${prefix}${client.intlGet('en', 'commandSyntaxPlayers')}`;
        const lc = command.toLowerCase();

        const bmInstance = client.battlemetricsInstances[battlemetricsId];
        if (!bmInstance?.lastUpdateSuccessful)
            return client.intlGet(this.guildId, 'battlemetricsInstanceCouldNotBeFound', { id: battlemetricsId });

        let foundPlayers: string[] = [];
        if (lc === cmdPlayers || lc === cmdPlayersEn) {
            foundPlayers = bmInstance.getOnlinePlayerIdsOrderedByTime();
            if (foundPlayers.length === 0) return client.intlGet(this.guildId, 'couldNotFindAnyPlayers');
        } else if (lc.startsWith(`${cmdPlayer} `) || lc.startsWith(`${cmdPlayerEn} `)) {
            const name = lc.startsWith(`${cmdPlayer} `)
                ? command.slice(`${cmdPlayer} `.length).trim()
                : command.slice(`${cmdPlayerEn} `.length).trim();
            foundPlayers = bmInstance
                .getOnlinePlayerIdsOrderedByTime()
                .filter((id: string) => bmInstance.players[id]['name'].includes(name));
            if (foundPlayers.length === 0) return client.intlGet(this.guildId, 'couldNotFindPlayer', { name });
        } else {
            return null;
        }

        const trademark = this.generalSettings.trademark;
        const trademarkStr = trademark === 'NOT SHOWING' ? '' : `${trademark} | `;
        const maxLen = 128 - trademarkStr.length;
        const leftLen = `...xxx ${client.intlGet(this.guildId, 'more')}.`.length;

        let str = '';
        let idx = 0;
        for (const playerId of foundPlayers) {
            const time = bmInstance.getOnlineTime(playerId);
            const part = `${bmInstance.players[playerId]['name']} [${time?.[1] ?? ''}], `;
            if (str.length + part.length + leftLen >= maxLen) break;
            str += part;
            idx++;
        }

        if (str) {
            str = str.slice(0, -2);
            return idx < foundPlayers.length
                ? client.intlGet(this.guildId, 'morePlayers', { players: str, number: foundPlayers.length - idx })
                : `${str}.`;
        }
        return null;
    }

    getCommandPop(isInfoChannel = false): string {
        const client = getClient();
        if (isInfoChannel) {
            return `${this.info.players}${this.info.isQueue() ? `(${this.info.queuedPlayers})` : ''}/${this.info.maxPlayers}`;
        }
        const str = client.intlGet(this.guildId, 'populationPlayers', {
            current: this.info.players,
            max: this.info.maxPlayers,
        });
        const queue = this.info.isQueue()
            ? ` ${client.intlGet(this.guildId, 'populationQueue', { number: this.info.queuedPlayers })}`
            : '';
        return `${str}${queue}`;
    }

    async getCommandProx(command: string, callerSteamId: string): Promise<string | null> {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdProx = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxProx')}`;
        const cmdProxEn = `${prefix}${client.intlGet('en', 'commandSyntaxProx')}`;
        const lc = command.toLowerCase();

        const teamInfo = await this.getTeamInfoAsync();
        if (!(await this.isResponseValid(teamInfo))) return null;
        TeamHandler.handler(this, client, teamInfo.teamInfo);
        this.team.updateTeam(teamInfo.teamInfo);
        const caller = this.team.getPlayer(callerSteamId);

        if (lc === cmdProx || lc === cmdProxEn) {
            const alive = this.team.players.filter((p: any) => p.steamId !== callerSteamId && p.isAlive);
            if (alive.length === 0) return client.intlGet(this.guildId, 'onlyOneInTeam');
            const closest = alive
                .sort(
                    (a: any, b: any) =>
                        GameMap.getDistance(a.x, a.y, caller.x, caller.y) -
                        GameMap.getDistance(b.x, b.y, caller.x, caller.y),
                )
                .slice(0, 3);
            const parts = closest.map(
                (p: any) =>
                    `${p.name} (${Math.floor(GameMap.getDistance(p.x, p.y, caller.x, caller.y))}m [${p.pos.location}])`,
            );
            return parts.length > 0 ? `${parts.join(', ')}.` : client.intlGet(this.guildId, 'allTeammatesAreDead');
        }

        const memberName = lc.startsWith(`${cmdProx} `)
            ? command.slice(`${cmdProx} `.length).trim()
            : command.slice(`${cmdProxEn} `.length).trim();
        for (const player of this.team.players) {
            if (player.name.includes(memberName)) {
                return client.intlGet(this.guildId, 'proxLocation', {
                    name: player.name,
                    distance: Math.floor(GameMap.getDistance(caller.x, caller.y, player.x, player.y)),
                    caller: caller.name,
                    direction: GameMap.getAngleBetweenPoints(caller.x, caller.y, player.x, player.y),
                    location: player.pos.location,
                });
            }
        }
        return client.intlGet(this.guildId, 'couldNotIdentifyMember', { name: memberName });
    }

    getCommandRecycle(command: string): string {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdRecycle = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxRecycle')}`;
        const cmdRecycleEn = `${prefix}${client.intlGet('en', 'commandSyntaxRecycle')}`;
        const rest = command.toLowerCase().startsWith(`${cmdRecycle} `)
            ? command.slice(`${cmdRecycle} `.length).trim()
            : command.slice(`${cmdRecycleEn} `.length).trim();

        const words = rest.split(' ');
        const lastWord = words[words.length - 1];
        const isNum = !isNaN(lastWord as any) && lastWord !== '';
        const itemName = isNum ? rest.slice(0, -lastWord.length).trim() : rest;
        const quantity = isNum ? parseInt(lastWord) : 1;

        const itemId = client.items.getClosestItemIdByName(itemName);
        if (!itemId || itemName === '') return client.intlGet(this.guildId, 'noItemWithNameFound', { name: itemName });
        const name = client.items.getName(itemId);
        const recycleDetails = client.rustlabs.getRecycleDetailsById(itemId);
        if (!recycleDetails) return client.intlGet(this.guildId, 'couldNotFindRecycleDetails', { name });

        const recycleData = client.rustlabs.getRecycleDataFromArray([
            { itemId: recycleDetails[0], quantity, itemIsBlueprint: false },
        ]);
        let str = `${name}: `;
        for (const item of recycleData) str += `${client.items.getName(item.itemId)} x${item.quantity}, `;
        return str.slice(0, -2);
    }

    getCommandResearch(command: string): string {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdResearch = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxResearch')}`;
        const cmdResearchEn = `${prefix}${client.intlGet('en', 'commandSyntaxResearch')}`;
        const itemInput = command.toLowerCase().startsWith(`${cmdResearch} `)
            ? command.slice(`${cmdResearch} `.length).trim()
            : command.slice(`${cmdResearchEn} `.length).trim();

        const itemId = client.items.getClosestItemIdByName(itemInput);
        if (!itemId || !itemInput) return client.intlGet(this.guildId, 'noItemWithNameFound', { name: itemInput });
        const itemName = client.items.getName(itemId);
        const details = client.rustlabs.getResearchDetailsById(itemId);
        if (!details) return client.intlGet(this.guildId, 'couldNotFindResearchDetails', { name: itemName });

        let str = `${itemName}: `;
        if (details[2].researchTable !== null)
            str += `${client.intlGet(this.guildId, 'researchTable')} (${details[2].researchTable})`;
        if (details[2].workbench !== null) {
            const wb = details[2].workbench;
            str += `, ${client.items.getName(wb.type)} (${wb.scrap} (${wb.totalScrap}))`;
        }
        return `${str}.`;
    }

    async getCommandSend(command: string, callerName: string): Promise<string> {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdSend = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxSend')}`;
        const cmdSendEn = `${prefix}${client.intlGet('en', 'commandSyntaxSend')}`;
        const rest = command.toLowerCase().startsWith(`${cmdSend} `)
            ? command.slice(`${cmdSend} `.length).trim()
            : command.slice(`${cmdSendEn} `.length).trim();
        const name = rest.replace(/ .*/, '');
        const message = rest.slice(name.length + 1).trim();

        if (!name || !message) return client.intlGet(this.guildId, 'missingArguments');

        const credentials = InstanceUtils.readCredentialsFile(this.guildId);
        for (const player of this.team.players) {
            if (player.name.includes(name)) {
                if (!(player.steamId in credentials))
                    return client.intlGet(this.guildId, 'userNotRegistered', { user: player.name });
                const discordUserId = credentials[player.steamId].discordUserId;
                const user = await DiscordTools.getUserById(this.guildId, discordUserId);
                if (!user) return client.intlGet(this.guildId, 'couldNotFindUser', { userId: discordUserId });
                await client.messageSend(user, {
                    embeds: [DiscordEmbeds.getUserSendEmbed(this.guildId, this.serverId, callerName, message)],
                });
                return client.intlGet(this.guildId, 'messageWasSent');
            }
        }
        return client.intlGet(this.guildId, 'couldNotIdentifyMember', { name });
    }

    getCommandSmall(isInfoChannel = false): any {
        const client = getClient();
        const strings: string[] = [];
        if (this.mapMarkers.crateSmallOilRigTimer) {
            const time = Timer.getTimeLeftOfTimer(this.mapMarkers.crateSmallOilRigTimer);
            if (time) {
                if (isInfoChannel)
                    return client.intlGet(this.guildId, 'timeUntilUnlocksAt', {
                        time: Timer.getTimeLeftOfTimer(this.mapMarkers.crateSmallOilRigTimer, 's'),
                        location: this.mapMarkers.crateSmallOilRigLocation,
                    });
                strings.push(
                    client.intlGet(this.guildId, 'timeBeforeCrateAtSmallOilRigUnlocks', {
                        time,
                        location: this.mapMarkers.crateSmallOilRigLocation,
                    }),
                );
            }
        }
        if (strings.length === 0) {
            if (!this.mapMarkers.timeSinceSmallOilRigWasTriggered) {
                return isInfoChannel
                    ? client.intlGet(this.guildId, 'noData')
                    : client.intlGet(this.guildId, 'noDataOnSmallOilRig');
            }
            const time = Timer.secondsToFullScale(
                (Date.now() - this.mapMarkers.timeSinceSmallOilRigWasTriggered.getTime()) / 1000,
                isInfoChannel ? 's' : '',
            );
            return isInfoChannel
                ? client.intlGet(this.guildId, 'timeSinceLastEvent', { time })
                : client.intlGet(this.guildId, 'timeSinceHeavyScientistsOnSmall', { time });
        }
        return strings;
    }

    getCommandStack(command: string): string {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdStack = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxStack')}`;
        const cmdStackEn = `${prefix}${client.intlGet('en', 'commandSyntaxStack')}`;
        const rest = command.toLowerCase().startsWith(`${cmdStack} `)
            ? command.slice(`${cmdStack} `.length).trim()
            : command.slice(`${cmdStackEn} `.length).trim();

        const itemId = client.items.getClosestItemIdByName(rest);
        if (!itemId) return client.intlGet(this.guildId, 'noItemWithNameFound', { name: rest });
        const itemName = client.items.getName(itemId);
        const details = client.rustlabs.getStackDetailsById(itemId);
        if (!details) return client.intlGet(this.guildId, 'couldNotFindStackDetails', { name: itemName });
        return client.intlGet(this.guildId, 'stackSizeOfItem', { item: itemName, quantity: details[2].quantity });
    }

    getCommandSteamId(command: string, callerSteamId: string | null, callerName: string | null): string | null {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdSteamId = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxSteamid')}`;
        const cmdSteamIdEn = `${prefix}${client.intlGet('en', 'commandSyntaxSteamid')}`;
        const lc = command.toLowerCase();

        if (lc === cmdSteamId || lc === cmdSteamIdEn) {
            return callerSteamId && callerName ? `${callerName}: ${callerSteamId}` : null;
        }

        const name = lc.startsWith(`${cmdSteamId} `)
            ? command.slice(`${cmdSteamId} `.length).trim()
            : command.slice(`${cmdSteamIdEn} `.length).trim();
        for (const player of this.team.players) {
            if (player.name.includes(name)) return `${player.name}: ${player.steamId}`;
        }
        return client.intlGet(this.guildId, 'couldNotIdentifyMember', { name });
    }

    getCommandTeam(): string | null {
        const names = this.team.players.map((p: any) => p.name).join(', ');
        return names ? `${names}.` : null;
    }

    getCommandTime(isInfoChannel = false): any {
        const client = getClient();
        const time = Timer.convertDecimalToHoursMinutes(this.time.time);
        if (isInfoChannel) return [time, this.time.getTimeTillDayOrNight('s')];

        const currentTime = client.intlGet(this.guildId, 'inGameTime', { time });
        const timeLeft = this.time.getTimeTillDayOrNight();
        if (!timeLeft) return currentTime;
        const locString = this.time.isDay() ? 'timeTillNightfall' : 'timeTillDaylight';
        return `${currentTime} ${client.intlGet(this.guildId, locString, { time: timeLeft })}`;
    }

    getCommandTimer(command: string): any {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdTimer = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxTimer')}`;
        const cmdTimerEn = `${prefix}${client.intlGet('en', 'commandSyntaxTimer')}`;
        const cmdTimers = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxTimers')}`;
        const cmdTimersEn = `${prefix}${client.intlGet('en', 'commandSyntaxTimers')}`;
        const cmdAdd = client.intlGet(this.guildId, 'commandSyntaxAdd');
        const cmdAddEn = client.intlGet('en', 'commandSyntaxAdd');
        const cmdRemove = client.intlGet(this.guildId, 'commandSyntaxRemove');
        const cmdRemoveEn = client.intlGet('en', 'commandSyntaxRemove');
        const lc = command.toLowerCase();

        if (lc === cmdTimers || lc === cmdTimersEn) {
            if (Object.keys(this.timers).length === 0) return client.intlGet(this.guildId, 'noActiveTimers');
            return Object.entries(this.timers).map(([id, content]: any) =>
                client.intlGet(this.guildId, 'timeLeftTimer', {
                    id: parseInt(id),
                    time: Timer.getTimeLeftOfTimer(content.timer),
                    message: content.message,
                }),
            );
        }

        const rest = lc.startsWith(`${cmdTimer} `)
            ? command.slice(`${cmdTimer} `.length).trim()
            : command.slice(`${cmdTimerEn} `.length).trim();
        const subcommand = rest.replace(/ .*/, '');
        const value = rest.slice(subcommand.length + 1);
        const sub = subcommand.toLowerCase();

        if (sub === cmdAdd.toLowerCase() || sub === cmdAddEn.toLowerCase()) {
            const timeStr = value.replace(/ .*/, '');
            const msg = value.slice(timeStr.length + 1);
            if (!msg) return client.intlGet(this.guildId, 'missingTimerMessage');
            const seconds = Timer.getSecondsFromStringTime(timeStr);
            if (seconds === null) return client.intlGet(this.guildId, 'timeFormatInvalid');

            let id = 0;
            while (Object.keys(this.timers).map(Number).includes(id)) id++;
            this.timers[id] = {
                timer: new Timer.Timer(() => {
                    this.sendInGameMessage(client.intlGet(this.guildId, 'timer', { message: msg }));
                    delete this.timers[id];
                    this.persistCustomTimersState();
                }, seconds * 1000),
                message: msg,
            };
            this.timers[id].timer.start();
            return client.intlGet(this.guildId, 'timerSet', { time: timeStr });
        } else if (sub === cmdRemove.toLowerCase() || sub === cmdRemoveEn.toLowerCase()) {
            const id = parseInt(value.replace(/ .*/, ''));
            if (isNaN(id)) return client.intlGet(this.guildId, 'timerIdInvalid');
            if (!Object.keys(this.timers).map(Number).includes(id))
                return client.intlGet(this.guildId, 'timerIdDoesNotExist', { id });
            this.timers[id].timer.stop();
            delete this.timers[id];
            return client.intlGet(this.guildId, 'timerRemoved', { id });
        }
        return null;
    }

    async getCommandTranslateTo(command: string): Promise<string> {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdTr = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxTranslateTo')}`;
        const cmdTrEn = `${prefix}${client.intlGet('en', 'commandSyntaxTranslateTo')}`;
        const cmdLang = client.intlGet(this.guildId, 'commandSyntaxLanguage');
        const cmdLangEn = client.intlGet('en', 'commandSyntaxLanguage');
        const lc = command.toLowerCase();

        if (lc.startsWith(`${cmdTr} ${cmdLang} `) || lc.startsWith(`${cmdTrEn} ${cmdLangEn} `)) {
            const lang = lc.startsWith(`${cmdTr} ${cmdLang} `)
                ? command.slice(`${cmdTr} ${cmdLang} `.length).trim()
                : command.slice(`${cmdTrEn} ${cmdLangEn} `.length).trim();
            return lang in languages
                ? client.intlGet(this.guildId, 'languageCode', { code: (languages as any)[lang] })
                : client.intlGet(this.guildId, 'couldNotFindLanguage', { language: lang });
        }

        const rest = lc.startsWith(`${cmdTr} `)
            ? command.slice(`${cmdTr} `.length).trim()
            : command.slice(`${cmdTrEn} `.length).trim();
        const lang = rest.replace(/ .*/, '');
        const text = rest.slice(lang.length).trim();
        if (!lang || !text) return client.intlGet(this.guildId, 'missingArguments');

        try {
            return await Translate(text, lang);
        } catch (_e) {
            return client.intlGet(this.guildId, 'languageLangNotSupported', { language: lang });
        }
    }

    async getCommandTranslateFromTo(command: string): Promise<string> {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdTrf = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxTranslateFromTo')}`;
        const cmdTrfEn = `${prefix}${client.intlGet('en', 'commandSyntaxTranslateFromTo')}`;
        const rest = command.toLowerCase().startsWith(`${cmdTrf} `)
            ? command.slice(`${cmdTrf} `.length).trim()
            : command.slice(`${cmdTrfEn} `.length).trim();

        const from = rest.replace(/ .*/, '');
        const remaining = rest.slice(from.length).trim();
        const to = remaining.replace(/ .*/, '');
        const text = remaining.slice(to.length).trim();
        if (!from || !to || !text) return client.intlGet(this.guildId, 'missingArguments');

        try {
            return await Translate(text, { from, to });
        } catch (e: any) {
            const match = /The language "(.*?)"/.exec(e?.message ?? '');
            return match?.[1]
                ? client.intlGet(this.guildId, 'languageLangNotSupported', { language: match[1] })
                : client.intlGet(this.guildId, 'languageNotSupported');
        }
    }

    async getCommandTTS(command: string, callerName: string): Promise<string> {
        const client = getClient();
        const prefix = this.generalSettings.prefix;
        const cmdTTS = `${prefix}${client.intlGet(this.guildId, 'commandSyntaxTTS')}`;
        const cmdTTSEn = `${prefix}${client.intlGet('en', 'commandSyntaxTTS')}`;
        const text = command.toLowerCase().startsWith(`${cmdTTS} `)
            ? command.slice(`${cmdTTS} `.length).trim()
            : command.slice(`${cmdTTSEn} `.length).trim();
        await DiscordMessages.sendTTSMessage(this.guildId, callerName, text);
        await DiscordVoice.sendDiscordVoiceMessage(this.guildId, text);
        return client.intlGet(this.guildId, 'sentTextToSpeech');
    }

    getCommandUnmute(): string {
        const client = getClient();
        const instance = client.getInstance(this.guildId);
        instance.generalSettings.muteInGameBotMessages = false;
        this.generalSettings.muteInGameBotMessages = false;
        client.setInstance(this.guildId, instance);
        return client.intlGet(this.guildId, 'inGameBotMessagesUnmuted');
    }

    getCommandUpkeep(): any {
        const client = getClient();
        const instance = client.getInstance(this.guildId);
        const strings: string[] = [];
        const upkeepStr = client.intlGet(this.guildId, 'upkeep').toLowerCase();
        for (const [key, value] of Object.entries(instance.serverList[this.serverId].storageMonitors) as [
            string,
            any,
        ][]) {
            if (value.type !== 'toolCupboard' || !value.upkeep) continue;
            strings.push(`${value.name} [${key}] ${upkeepStr}: ${value.upkeep}`);
        }
        return strings.length > 0 ? strings : client.intlGet(this.guildId, 'noToolCupboardWereFound');
    }

    getCommandUptime(): string {
        const client = getClient();
        const fmt = (d: Date | null) =>
            d ? Timer.secondsToFullScale((Date.now() - d.getTime()) / 1000) : client.intlGet(this.guildId, 'offline');
        const bot = fmt(client.uptimeBot);
        const server = fmt(this.uptimeServer);
        const str = `${client.intlGet(this.guildId, 'bot')}: ${bot} ${client.intlGet(this.guildId, 'server')}: ${server}.`;
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getCommandWipe(isInfoChannel = false): string {
        const client = getClient();
        if (isInfoChannel)
            return client.intlGet(this.guildId, 'dayOfWipe', {
                day: Math.ceil(this.info.getSecondsSinceWipe() / (60 * 60 * 24)),
            });
        return client.intlGet(this.guildId, 'timeSinceWipe', { time: this.info.getTimeSinceWipe() });
    }

    getCommandTravelingVendor(isInfoChannel = false): any {
        const client = getClient();
        const strings: string[] = [];
        for (const vendor of this.mapMarkers.travelingVendors) {
            if (isInfoChannel) return client.intlGet(this.guildId, 'atLocation', { location: vendor.location.string });
            strings.push(
                client.intlGet(this.guildId, 'travelingVendorLocatedAt', { location: vendor.location.string }),
            );
        }

        if (strings.length === 0) {
            if (!this.mapMarkers.timeSinceTravelingVendorWasOnMap) {
                return isInfoChannel
                    ? client.intlGet(this.guildId, 'notActive')
                    : client.intlGet(this.guildId, 'travelingVendorNotOnMap');
            }
            const time = Timer.secondsToFullScale(
                (Date.now() - this.mapMarkers.timeSinceTravelingVendorWasOnMap.getTime()) / 1000,
                isInfoChannel ? 's' : '',
            );
            return isInfoChannel
                ? client.intlGet(this.guildId, 'timeSinceLast', { time })
                : client.intlGet(this.guildId, 'timeSinceTravelingVendorWasOnMap', { time });
        }
        return strings;
    }

    getCommandDeepSea(isInfoChannel = false): any {
        const client = getClient();
        const strings: string[] = [];
        for (const deepSea of this.mapMarkers.deepSeas) {
            if (isInfoChannel) return client.intlGet(this.guildId, 'atLocation', { location: deepSea.location.string });
            strings.push(client.intlGet(this.guildId, 'deepSeaLocatedAt', { location: deepSea.location.string }));
        }

        if (strings.length === 0) {
            if (!this.mapMarkers.timeSinceDeepSeaWasOnMap) {
                return isInfoChannel
                    ? client.intlGet(this.guildId, 'notActive')
                    : client.intlGet(this.guildId, 'deepSeaNotOnMap');
            }
            const time = Timer.secondsToFullScale(
                (Date.now() - this.mapMarkers.timeSinceDeepSeaWasOnMap.getTime()) / 1000,
                isInfoChannel ? 's' : '',
            );
            return isInfoChannel
                ? client.intlGet(this.guildId, 'timeSinceLast', { time })
                : client.intlGet(this.guildId, 'timeSinceDeepSeaWasOnMap', { time });
        }
        return strings;
    }
}
