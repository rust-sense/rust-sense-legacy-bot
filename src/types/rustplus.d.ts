declare module '@liamcottle/rustplus.js' {
    import { EventEmitter } from 'events';

    export interface RustPlusOptions {
        server: string;
        port: number;
        playerId: string;
        playerToken: string;
    }

    export interface AppMessage {
        response?: {
            seq?: number;
            [key: string]: unknown;
        };
        broadcast?: {
            [key: string]: unknown;
        };
    }

    export class RustPlus extends EventEmitter {
        constructor(server: string, port: number, playerId: string, playerToken: string);

        server: string;
        port: number;
        playerId: string;
        playerToken: string;
        seq: number;
        connected: boolean;

        connect(): void;
        disconnect(): void;
        sendRequest(request: unknown, callback?: (message: AppMessage) => void): void;
        sendRequestAsync(request: unknown, timeoutMilliseconds?: number): Promise<AppMessage>;
        sendTeamMessage(message: string): void;
        getEntityInfo(entityId: number, callback?: (message: AppMessage) => void): void;
        getMap(callback?: (message: AppMessage) => void): void;
        getTeamInfo(callback?: (message: AppMessage) => void): void;
        getTime(callback?: (message: AppMessage) => void): void;
        getMapMarkers(callback?: (message: AppMessage) => void): void;
        getInfo(callback?: (message: AppMessage) => void): void;
        turnSmartSwitchOn(entityId: number, callback?: (message: AppMessage) => void): void;
        turnSmartSwitchOff(entityId: number, callback?: (message: AppMessage) => void): void;
        setEntityValue(entityId: number, value: boolean, callback?: (message: AppMessage) => void): void;
        checkSubscription(callback?: (message: AppMessage) => void): void;
        setSubscription(value: boolean, callback?: (message: AppMessage) => void): void;
        getCameraFrame(identifier: string, frame: number, callback?: (message: AppMessage) => void): void;
        promoteToLeader(steamId: string, callback?: (message: AppMessage) => void): void;
        getTeamChat(callback?: (message: AppMessage) => void): void;
        sendCameraInput(cameraId: string, buttons: number): void;

        on(event: 'connected', listener: () => void): this;
        on(event: 'disconnected', listener: () => void): this;
        on(event: 'error', listener: (error: Error) => void): this;
        on(event: 'message', listener: (message: AppMessage) => void): this;
        on(event: 'request', listener: (request: unknown) => void): this;
        on(event: string, listener: (...args: any[]) => void): this;
    }

    export default RustPlus;
}
