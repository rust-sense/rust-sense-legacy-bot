import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import axios from 'axios';
import { fcmLogger as log } from '../logger.js';
import {
    AndroidCheckinRequestSchema,
    AndroidCheckinResponseSchema,
} from './proto/checkin_pb.js';

const CHECKIN_URL = 'https://android.clients.google.com/checkin';

export async function checkIn(androidId: string, securityToken: string): Promise<any> {
    log.debug(`sending checkIn request to ${CHECKIN_URL}`);
    const buffer = getCheckinRequest(androidId, securityToken);
    const response = await axios.post(CHECKIN_URL, buffer, {
        headers: { 'Content-Type': 'application/x-protobuf' },
        responseType: 'arraybuffer',
    });
    log.debug(`checkIn response: HTTP ${response.status}, ${response.data.byteLength}B`);
    const body = new Uint8Array(response.data);
    const result = fromBinary(AndroidCheckinResponseSchema, body);
    log.debug(`checkIn decoded: androidId=${result.androidId}, securityToken=${result.securityToken}`);
    return result;
}

function getCheckinRequest(androidId: string, securityToken: string): Uint8Array {
    const request = create(AndroidCheckinRequestSchema, {
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
        id: androidId ? BigInt(androidId) : undefined,
        securityToken: securityToken ? BigInt(securityToken) : undefined,
    });
    return toBinary(AndroidCheckinRequestSchema, request);
}
