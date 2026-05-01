import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { rustPlusLogger as log } from '../logger.js';
import { Camera } from './Camera.js';
import { AppMessageSchema, AppRequestSchema } from './rustplus_pb.js';

export class RustPlus extends EventEmitter {
    server: string;
    port: number;
    playerId: string | number;
    playerToken: string | number;
    useFacepunchProxy: boolean;
    seq: number;
    seqCallbacks: Array<((message: any) => boolean | void) | undefined>;
    websocket: WebSocket | null;

    constructor(
        server: string,
        port: number,
        playerId: string | number,
        playerToken: string | number,
        useFacepunchProxy = false,
    ) {
        super();
        this.server = server;
        this.port = port;
        this.playerId = playerId;
        this.playerToken = playerToken;
        this.useFacepunchProxy = useFacepunchProxy;
        this.seq = 0;
        this.seqCallbacks = [];
        this.websocket = null;
    }

    connect(): void {
        if (this.websocket) {
            this.disconnect();
        }

        this.emit('connecting');

        const address = this.useFacepunchProxy
            ? `wss://companion-rust.facepunch.com/game/${this.server}/${this.port}`
            : `ws://${this.server}:${this.port}`;
        log.info(`connecting to ${address}`);
        this.websocket = new WebSocket(address);

        this.websocket.on('open', () => {
            log.info(`WebSocket connected to ${address}`);
            this.emit('connected');
        });

        this.websocket.on('error', (e: Error) => {
            log.error(`WebSocket error: ${e.message}`);
            this.emit('error', e);
        });

        this.websocket.on('message', (data: any) => {
            const message = fromBinary(AppMessageSchema, new Uint8Array(data));

            if (message.response && message.response.seq && this.seqCallbacks[message.response.seq]) {
                log.debug(`received response seq=${message.response.seq}`);
                const callback = this.seqCallbacks[message.response.seq]!;
                const result = callback(message);
                delete this.seqCallbacks[message.response.seq];
                if (result) return;
            } else {
                log.debug(`received broadcast message`);
            }

            this.emit('message', fromBinary(AppMessageSchema, new Uint8Array(data)));
        });

        this.websocket.on('close', () => {
            log.info('WebSocket disconnected');
            this.emit('disconnected');
        });
    }

    disconnect(): void {
        if (this.websocket) {
            this.websocket.terminate();
            this.websocket = null;
        }
    }

    isConnected(): boolean {
        return this.websocket?.readyState === WebSocket.OPEN;
    }

    sendRequest(data: any, callback?: (message: any) => boolean | void): void {
        const currentSeq = ++this.seq;
        const requestType = Object.keys(data).find((k) => k !== 'entityId') ?? 'unknown';
        log.debug(`sending request seq=${currentSeq} type=${requestType}`);

        if (callback) {
            this.seqCallbacks[currentSeq] = callback;
        }

        const request = create(AppRequestSchema, {
            seq: currentSeq,
            playerId: BigInt(this.playerId),
            playerToken: Number(this.playerToken),
            ...data,
        });

        this.websocket!.send(toBinary(AppRequestSchema, request));
        this.emit('request', request);
    }

    sendRequestAsync(data: any, timeoutMilliseconds = 10000): Promise<any> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout reached while waiting for response'));
            }, timeoutMilliseconds);

            this.sendRequest(data, (message: any) => {
                clearTimeout(timeout);
                if (message.response.error) {
                    reject(message.response.error);
                } else {
                    resolve(message.response);
                }
            });
        });
    }

    setEntityValue(entityId: number, value: boolean, callback?: (message: any) => void): void {
        this.sendRequest({ entityId, setEntityValue: { value } }, callback);
    }

    turnSmartSwitchOn(entityId: number, callback?: (message: any) => void): void {
        this.setEntityValue(entityId, true, callback);
    }

    turnSmartSwitchOff(entityId: number, callback?: (message: any) => void): void {
        this.setEntityValue(entityId, false, callback);
    }

    strobe(entityId: number, timeoutMilliseconds = 100, value = true): void {
        this.setEntityValue(entityId, value);
        setTimeout(() => {
            this.strobe(entityId, timeoutMilliseconds, !value);
        }, timeoutMilliseconds);
    }

    sendTeamMessage(message: string, callback?: (message: any) => void): void {
        this.sendRequest({ sendTeamMessage: { message } }, callback);
    }

    getEntityInfo(entityId: number, callback?: (message: any) => void): void {
        this.sendRequest({ entityId, getEntityInfo: {} }, callback);
    }

    getMap(callback?: (message: any) => void): void {
        this.sendRequest({ getMap: {} }, callback);
    }

    getTime(callback?: (message: any) => void): void {
        this.sendRequest({ getTime: {} }, callback);
    }

    getMapMarkers(callback?: (message: any) => void): void {
        this.sendRequest({ getMapMarkers: {} }, callback);
    }

    getInfo(callback?: (message: any) => void): void {
        this.sendRequest({ getInfo: {} }, callback);
    }

    getTeamInfo(callback?: (message: any) => void): void {
        this.sendRequest({ getTeamInfo: {} }, callback);
    }

    subscribeToCamera(identifier: string, callback?: (message: any) => void): void {
        this.sendRequest({ cameraSubscribe: { cameraId: identifier } }, callback);
    }

    unsubscribeFromCamera(callback?: (message: any) => void): void {
        this.sendRequest({ cameraUnsubscribe: {} }, callback);
    }

    sendCameraInput(buttons: number, x: number, y: number, callback?: (message: any) => void): void {
        this.sendRequest({ cameraInput: { buttons, mouseDelta: { x, y } } }, callback);
    }

    getCamera(identifier: string): Camera {
        return new Camera(this, identifier);
    }
}

export default RustPlus;
