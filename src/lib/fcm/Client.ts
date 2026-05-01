import { create } from '@bufbuild/protobuf';
import { sizeDelimitedEncode } from '@bufbuild/protobuf/wire';
import { EventEmitter } from 'events';
import tls from 'tls';
import {
    kCloseTag,
    kDataMessageStanzaTag,
    kHeartbeatAckTag,
    kHeartbeatPingTag,
    kIqStanzaTag,
    kLoginRequestTag,
    kLoginResponseTag,
    kMCSVersion,
    kStreamErrorStanzaTag,
} from './constants.js';

const TAG_NAMES: Record<number, string> = {
    [kHeartbeatPingTag]: 'HeartbeatPing',
    [kHeartbeatAckTag]: 'HeartbeatAck',
    [kLoginRequestTag]: 'LoginRequest',
    [kLoginResponseTag]: 'LoginResponse',
    [kCloseTag]: 'Close',
    [kIqStanzaTag]: 'IqStanza',
    [kDataMessageStanzaTag]: 'DataMessageStanza',
    [kStreamErrorStanzaTag]: 'StreamErrorStanza',
};
import { checkIn } from './gcm.js';
import { fcmLogger as log } from '../logger.js';
import { Parser } from './Parser.js';
import { LoginRequest_AuthService, LoginRequestSchema } from './proto/mcs_pb.js';

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
        log.debug('connect() called');
        await this._checkIn();
        this._connectSocket();
        if (!this._socket) return;
        this._parser = new Parser(this._socket);
        this._parser.on('message', this._onMessage);
        this._parser.on('error', this._onParserError);
        log.debug('parser attached to socket');
    }

    destroy(): void {
        this._destroy();
    }

    private async _checkIn(): Promise<void> {
        log.debug(`checkIn starting for androidId: ${this._androidId}`);
        await checkIn(this._androidId, this._securityToken);
        log.debug('checkIn complete');
    }

    private _connectSocket(): void {
        log.debug(`connecting to ${HOST}:${PORT}`);
        this._socket = tls.connect({ host: HOST, port: PORT, servername: HOST });
        this._socket.setKeepAlive(true);
        this._socket.on('connect', this._onSocketConnect);
        this._socket.on('close', this._onSocketClose);
        this._socket.on('error', this._onSocketError);
        const loginBuf = this._loginBuffer();
        log.debug(`writing login buffer (${loginBuf.length}B) to socket`);
        this._socket.write(loginBuf);
    }

    private _destroy(): void {
        log.debug('destroying socket and parser');
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
        const hexAndroidId = BigInt(this._androidId).toString(16);
        log.debug(`building login request: deviceId=android-${hexAndroidId}, persistentIds=${this._persistentIds.length}`);
        const request = create(LoginRequestSchema, {
            adaptiveHeartbeat: false,
            authService: LoginRequest_AuthService.ANDROID_ID,
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
        });

        const encoded = sizeDelimitedEncode(LoginRequestSchema, request);
        return Buffer.concat([Buffer.from([kMCSVersion, kLoginRequestTag]), encoded]);
    }

    private _handleSocketConnect(): void {
        this._retryCount = 0;
        log.info('socket connected');
        this.emit('connect');
    }

    private _handleSocketClose(): void {
        log.info('socket closed, retrying...');
        this.emit('disconnect');
        this._retry();
    }

    private _handleSocketError(error: Error): void {
        log.error(`socket error [${(error as any).code ?? 'unknown'}]: ${error.message}`);
        // socket errors are handled via the close event which triggers retry
    }

    private _handleParserError(error: Error): void {
        log.error(`parser error: ${error.message}`);
        this._retry();
    }

    private _retry(): void {
        this._destroy();
        const timeout = Math.min(++this._retryCount, MAX_RETRY_TIMEOUT) * 1000;
        log.debug(`scheduling retry #${this._retryCount} in ${timeout}ms`);
        this._retryTimeout = setTimeout(() => {
            this.connect().catch((err) => this.emit('error', err));
        }, timeout);
    }

    private _handleMessage({ tag, object }: { tag: number; object: any }): void {
        const tagName = TAG_NAMES[tag] ?? `unknown(${tag})`;
        log.debug(`message received: ${tagName}`);
        if (tag === kLoginResponseTag) {
            log.info('login response received');
            this._persistentIds = [];
        } else if (tag === kDataMessageStanzaTag) {
            this._onDataMessage(object);
        } else if (tag === kHeartbeatPingTag) {
            log.debug('heartbeat ping from server');
        } else if (tag === kHeartbeatAckTag) {
            log.debug('heartbeat ack from server');
        } else if (tag === kCloseTag) {
            log.info('server sent Close — connection will drop');
        } else if (tag === kStreamErrorStanzaTag) {
            log.error(`stream error from server: ${JSON.stringify(object)}`);
        } else if (tag === kIqStanzaTag) {
            log.debug(`IQ stanza: ${JSON.stringify(object)}`);
        }
    }

    private _onDataMessage(object: any): void {
        const keys = object.appData?.map((d: any) => d.key) ?? [];
        log.debug(`data message, persistentId: ${object.persistentId}, appData keys: [${keys.join(', ')}]`);

        if (this._persistentIds.includes(object.persistentId)) {
            log.debug(`duplicate persistentId ${object.persistentId}, skipping`);
            return;
        }

        // bot uses only unencrypted FCM messages — skip encrypted ones entirely
        if (keys.includes('crypto-key')) {
            log.warn('encrypted FCM message received, skipping (crypto-key present)');
            return;
        }

        this._persistentIds.push(object.persistentId);
        this.emit('ON_DATA_RECEIVED', object);
    }
}
