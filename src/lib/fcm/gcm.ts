import axios from 'axios';
import Long from 'long';
// @ts-ignore — no types for protobufjs/minimal
import * as $protobuf from 'protobufjs/minimal.js';
import { checkin_proto } from './proto/mcs_pb.js';

// Ensure Long is available for int64 field serialization
$protobuf.util.Long = Long;
$protobuf.configure();

const CHECKIN_URL = 'https://android.clients.google.com/checkin';

export async function checkIn(androidId: string, securityToken: string): Promise<any> {
    const buffer = getCheckinRequest(androidId, securityToken);
    const response = await axios.post(CHECKIN_URL, buffer, {
        headers: { 'Content-Type': 'application/x-protobuf' },
        responseType: 'arraybuffer',
    });
    const body = Buffer.from(response.data);
    const message = checkin_proto.AndroidCheckinResponse.decode(body);
    return checkin_proto.AndroidCheckinResponse.toObject(message, {
        longs: String,
        enums: String,
        bytes: String,
    });
}

function getCheckinRequest(androidId: string, securityToken: string): Buffer {
    const payload = {
        userSerialNumber: 0,
        checkin: {
            type: 3,
            chromeBuild: {
                platform: 2,
                chromeVersion: '63.0.3234.0',
                channel: 1,
            },
        },
        version: 3,
        id: androidId ? Long.fromString(androidId) : undefined,
        securityToken: securityToken ? Long.fromString(securityToken, true) : undefined,
    };
    const errMsg = checkin_proto.AndroidCheckinRequest.verify(payload);
    if (errMsg) throw new Error(errMsg);
    const message = checkin_proto.AndroidCheckinRequest.create(payload);
    return Buffer.from(checkin_proto.AndroidCheckinRequest.encode(message).finish());
}
