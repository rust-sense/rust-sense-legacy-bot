export const MCS_VERSION_TAG_AND_SIZE = 0;
export const MCS_TAG_AND_SIZE = 1;
export const MCS_SIZE = 2;
export const MCS_PROTO_BYTES = 3;

export const kVersionPacketLen = 1;
export const kTagPacketLen = 1;
export const kSizePacketLenMin = 1;
export const kSizePacketLenMax = 5;

export const kMCSVersion = 41;

export const kHeartbeatPingTag = 0;
export const kHeartbeatAckTag = 1;
export const kLoginRequestTag = 2;
export const kLoginResponseTag = 3;
export const kCloseTag = 4;
export const kMessageStanzaTag = 5;
export const kPresenceStanzaTag = 6;
export const kIqStanzaTag = 7;
export const kDataMessageStanzaTag = 8;
export const kBatchPresenceStanzaTag = 9;
export const kStreamErrorStanzaTag = 10;
export const kHttpRequestTag = 11;
export const kHttpResponseTag = 12;
export const kBindAccountRequestTag = 13;
export const kBindAccountResponseTag = 14;
export const kTalkMetadataTag = 15;
export const kNumProtoTypes = 16;
