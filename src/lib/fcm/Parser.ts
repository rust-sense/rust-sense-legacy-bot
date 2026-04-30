import { EventEmitter } from 'events';
import { BufferReader } from 'protobufjs';
import {
    kCloseTag,
    kDataMessageStanzaTag,
    kHeartbeatAckTag,
    kHeartbeatPingTag,
    kIqStanzaTag,
    kLoginRequestTag,
    kLoginResponseTag,
    kMCSVersion,
    kSizePacketLenMin,
    kStreamErrorStanzaTag,
    kTagPacketLen,
    kVersionPacketLen,
    MCS_PROTO_BYTES,
    MCS_SIZE,
    MCS_TAG_AND_SIZE,
    MCS_VERSION_TAG_AND_SIZE,
} from './constants.js';
import { mcs_proto } from './proto/mcs_pb.js';

export class Parser extends EventEmitter {
    private _socket: any;
    private _state: number;
    private _data: Buffer;
    private _sizePacketSoFar: number;
    private _messageTag: number;
    private _messageSize: number;
    private _handshakeComplete: boolean;
    private _isWaitingForData: boolean;
    private _onData: (buffer: Buffer) => void;

    constructor(socket: any) {
        super();
        this._socket = socket;
        this._state = MCS_VERSION_TAG_AND_SIZE;
        this._data = Buffer.alloc(0);
        this._sizePacketSoFar = 0;
        this._messageTag = 0;
        this._messageSize = 0;
        this._handshakeComplete = false;
        this._isWaitingForData = true;
        this._onData = this._onDataHandler.bind(this);
        this._socket.on('data', this._onData);
    }

    destroy(): void {
        this._isWaitingForData = false;
        this._socket.removeListener('data', this._onData);
    }

    private _emitError(error: Error): void {
        this.destroy();
        this.emit('error', error);
    }

    private _onDataHandler(buffer: Buffer): void {
        this._data = Buffer.concat([this._data, buffer]);
        if (this._isWaitingForData) {
            this._isWaitingForData = false;
            this._waitForData();
        }
    }

    private _waitForData(): void {
        let minBytesNeeded = 0;

        switch (this._state) {
            case MCS_VERSION_TAG_AND_SIZE:
                minBytesNeeded = kVersionPacketLen + kTagPacketLen + kSizePacketLenMin;
                break;
            case MCS_TAG_AND_SIZE:
                minBytesNeeded = kTagPacketLen + kSizePacketLenMin;
                break;
            case MCS_SIZE:
                minBytesNeeded = this._sizePacketSoFar + 1;
                break;
            case MCS_PROTO_BYTES:
                minBytesNeeded = this._messageSize;
                break;
            default:
                this._emitError(new Error(`Unexpected state: ${this._state}`));
                return;
        }

        if (this._data.length < minBytesNeeded) {
            this._isWaitingForData = true;
            return;
        }

        switch (this._state) {
            case MCS_VERSION_TAG_AND_SIZE:
                this._onGotVersion();
                break;
            case MCS_TAG_AND_SIZE:
                this._onGotMessageTag();
                break;
            case MCS_SIZE:
                this._onGotMessageSize();
                break;
            case MCS_PROTO_BYTES:
                this._onGotMessageBytes();
                break;
            default:
                this._emitError(new Error(`Unexpected state: ${this._state}`));
        }
    }

    private _onGotVersion(): void {
        const version = this._data.readInt8(0);
        this._data = this._data.slice(1);
        if (version < kMCSVersion && version !== 38) {
            this._emitError(new Error(`Got wrong version: ${version}`));
            return;
        }
        this._onGotMessageTag();
    }

    private _onGotMessageTag(): void {
        this._messageTag = this._data.readInt8(0);
        this._data = this._data.slice(1);
        this._onGotMessageSize();
    }

    private _onGotMessageSize(): void {
        let incompleteSizePacket = false;
        const reader = new BufferReader(this._data);

        try {
            this._messageSize = reader.int32();
        } catch (error: any) {
            if (error.message.startsWith('index out of range:')) {
                incompleteSizePacket = true;
            } else {
                this._emitError(error);
                return;
            }
        }

        if (incompleteSizePacket) {
            this._sizePacketSoFar = reader.pos;
            this._state = MCS_SIZE;
            this._waitForData();
            return;
        }

        this._data = this._data.slice(reader.pos);
        this._sizePacketSoFar = 0;

        if (this._messageSize > 0) {
            this._state = MCS_PROTO_BYTES;
            this._waitForData();
        } else {
            this._onGotMessageBytes();
        }
    }

    private _onGotMessageBytes(): void {
        const type = this._buildTypeFromTag(this._messageTag);
        if (!type) {
            this._emitError(new Error('Unknown tag'));
            return;
        }

        if (this._messageSize === 0) {
            this.emit('message', { tag: this._messageTag, object: {} });
            this._getNextMessage();
            return;
        }

        if (this._data.length < this._messageSize) {
            this._state = MCS_PROTO_BYTES;
            this._waitForData();
            return;
        }

        const buffer = this._data.slice(0, this._messageSize);
        this._data = this._data.slice(this._messageSize);
        const message = type.decode(buffer);
        const object = type.toObject(message, {
            longs: String,
            enums: String,
            bytes: Buffer,
        });

        this.emit('message', { tag: this._messageTag, object });

        if (this._messageTag === kLoginResponseTag) {
            if (this._handshakeComplete) {
                console.error('Unexpected login response');
            } else {
                this._handshakeComplete = true;
            }
        }

        this._getNextMessage();
    }

    private _getNextMessage(): void {
        this._messageTag = 0;
        this._messageSize = 0;
        this._state = MCS_TAG_AND_SIZE;
        this._waitForData();
    }

    private _buildTypeFromTag(tag: number): any {
        switch (tag) {
            case kHeartbeatPingTag:
                return mcs_proto.HeartbeatPing;
            case kHeartbeatAckTag:
                return mcs_proto.HeartbeatAck;
            case kLoginRequestTag:
                return mcs_proto.LoginRequest;
            case kLoginResponseTag:
                return mcs_proto.LoginResponse;
            case kCloseTag:
                return mcs_proto.Close;
            case kIqStanzaTag:
                return mcs_proto.IqStanza;
            case kDataMessageStanzaTag:
                return mcs_proto.DataMessageStanza;
            case kStreamErrorStanzaTag:
                return mcs_proto.StreamErrorStanza;
            default:
                return null;
        }
    }
}
