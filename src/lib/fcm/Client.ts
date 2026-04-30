import { EventEmitter } from 'events';
import Long from 'long';
import net from 'net';
import tls from 'tls';
import { kDataMessageStanzaTag, kLoginRequestTag, kLoginResponseTag, kMCSVersion } from './constants.js';
import { checkIn } from './gcm.js';
import { Parser } from './Parser.js';
import { mcs_proto } from './proto/mcs_pb.js';

const HOST = 'mtalk.google.com';
const PORT = 5228;
const MAX_RETRY_TIMEOUT = 15;

export default class Client extends EventEmitter {
    private _androidId: string;
    private _securityToken: string;
    private _persistentIds: string[];
    private _retryCount: number;
    private _retryTimeout: ReturnType<typeof setTimeout> | null;
    private _socket: tls.TLSSocket | null;
    private _parser: Parser | null;

    private _onSocketConnect: () => void;
    private _onSocketClose: () => void;
    private _onSocketError: (error: Error) => void;
    private _onMessage: (msg: { tag: number; object: any }) => void;
    private _onParserError: (error: Error) => void;

    constructor(androidId: string, securityToken: string, persistentIds: string[] = []) {
        super();
        this._androidId = androidId;
        this._securityToken = securityToken;
        this._persistentIds = persistentIds;
        this._retryCount = 0;
        this._retryTimeout = null;
        this._socket = null;
        this._parser = null;
        this._onSocketConnect = this._handleSocketConnect.bind(this);
        this._onSocketClose = this._handleSocketClose.bind(this);
        this._onSocketError = this._handleSocketError.bind(this);
        this._onMessage = this._handleMessage.bind(this);
        this._onParserError = this._handleParserError.bind(this);
    }

    async connect(): Promise<void> {
        await this._checkIn();
        this._connectSocket();
        if (!this._socket) return;
        this._parser = new Parser(this._socket);
        this._parser.on('message', this._onMessage);
        this._parser.on('error', this._onParserError);
    }

    destroy(): void {
        this._destroy();
    }

    private async _checkIn(): Promise<void> {
        await checkIn(this._androidId, this._securityToken);
    }

    private _connectSocket(): void {
        this._socket = new tls.TLSSocket(new net.Socket());
        this._socket.setKeepAlive(true);
        this._socket.on('connect', this._onSocketConnect);
        this._socket.on('close', this._onSocketClose);
        this._socket.on('error', this._onSocketError);
        this._socket.connect({ host: HOST, port: PORT });
        this._socket.write(this._loginBuffer());
    }

    private _destroy(): void {
        if (this._retryTimeout) {
            clearTimeout(this._retryTimeout);
            this._retryTimeout = null;
        }
        if (this._socket) {
            this._socket.removeListener('connect', this._onSocketConnect);
            this._socket.removeListener('close', this._onSocketClose);
            this._socket.removeListener('error', this._onSocketError);
            this._socket.destroy();
            this._socket = null;
        }
        if (this._parser) {
            this._parser.removeListener('message', this._onMessage);
            this._parser.removeListener('error', this._onParserError);
            this._parser.destroy();
            this._parser = null;
        }
    }

    private _loginBuffer(): Buffer {
        const hexAndroidId = Long.fromString(this._androidId).toString(16);
        const loginRequest = {
            adaptiveHeartbeat: false,
            authService: 2,
            authToken: this._securityToken,
            id: 'chrome-63.0.3234.0',
            domain: 'mcs.android.com',
            deviceId: `android-${hexAndroidId}`,
            networkType: 1,
            resource: this._androidId,
            user: this._androidId,
            useRmq2: true,
            setting: [{ name: 'new_vc', value: '1' }],
            clientEvent: [],
            receivedPersistentId: this._persistentIds,
        };

        const errorMessage = mcs_proto.LoginRequest.verify(loginRequest);
        if (errorMessage) throw new Error(errorMessage);

        const buffer = mcs_proto.LoginRequest.encodeDelimited(loginRequest).finish();
        return Buffer.concat([Buffer.from([kMCSVersion, kLoginRequestTag]), Buffer.from(buffer)]);
    }

    private _handleSocketConnect(): void {
        this._retryCount = 0;
        this.emit('connect');
    }

    private _handleSocketClose(): void {
        this.emit('disconnect');
        this._retry();
    }

    private _handleSocketError(_error: Error): void {
        // socket errors are handled via the close event which triggers retry
    }

    private _handleParserError(_error: Error): void {
        this._retry();
    }

    private _retry(): void {
        this._destroy();
        const timeout = Math.min(++this._retryCount, MAX_RETRY_TIMEOUT) * 1000;
        this._retryTimeout = setTimeout(() => {
            this.connect().catch((err) => this.emit('error', err));
        }, timeout);
    }

    private _handleMessage({ tag, object }: { tag: number; object: any }): void {
        if (tag === kLoginResponseTag) {
            this._persistentIds = [];
        } else if (tag === kDataMessageStanzaTag) {
            this._onDataMessage(object);
        }
    }

    private _onDataMessage(object: any): void {
        if (this._persistentIds.includes(object.persistentId)) {
            return;
        }

        // bot uses only unencrypted FCM messages — skip encrypted ones entirely
        if ('crypto-key' in object.appData) {
            console.warn('Skipping encrypted FCM message (crypto-key present)');
            return;
        }

        this._persistentIds.push(object.persistentId);
        this.emit('ON_DATA_RECEIVED', object);
    }
}
