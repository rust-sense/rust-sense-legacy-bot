declare module '@liamcottle/push-receiver' {
    export interface PushReceiverConfig {
        firebase: {
            appId: string;
            apiKey: string;
            projectId: string;
            messagingSenderId: string;
        };
    }

    export interface PushNotification {
        notification: {
            title: string;
            body: string;
        };
        data: Record<string, string>;
    }

    export class PushReceiver extends EventEmitter {
        constructor(config: PushReceiverConfig);
        
        connect(): void;
        disconnect(): void;
        
        on(event: 'notification', listener: (notification: PushNotification) => void): this;
        on(event: 'connected', listener: () => void): this;
        on(event: 'disconnected', listener: () => void): this;
        on(event: 'error', listener: (error: Error) => void): this;
    }

    export default PushReceiver;
}

declare module '@liamcottle/push-receiver/src/client' {
    import { EventEmitter } from 'events';

    export default class Client extends EventEmitter {
        constructor(androidId: any, securityToken: any, persistentIds: any[]);
        connect(): void;
        destroy(): void;
    }
}
