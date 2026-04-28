import { client } from '../index.js';

const GRID_DIAMETER = 146.28571;
const MARGIN = 1;

function getNumberOfGrids(mapSize: number): number {
    const n = Math.floor(mapSize / GRID_DIAMETER);
    return Math.max(1, n);
}

export const gridDiameter = GRID_DIAMETER;

export function getPos(x: number, y: number, mapSize: number, rustplus: any) {
    const correctedMapSize = getCorrectedMapSize(mapSize);
    const pos = { location: null as string | null, monument: null as string | null, string: null as string | null, x, y };

    if (isOutsideGridSystem(x, y, correctedMapSize)) {
        if (isOutsideRowOrColumn(x, y, correctedMapSize)) {
            if (x < 0 && y > correctedMapSize) {
                pos.location = client.intlGet(rustplus.guildId, 'northWest');
            } else if (x < 0 && y < 0) {
                pos.location = client.intlGet(rustplus.guildId, 'southWest');
            } else if (x > correctedMapSize && y > correctedMapSize) {
                pos.location = client.intlGet(rustplus.guildId, 'northEast');
            } else {
                pos.location = client.intlGet(rustplus.guildId, 'southEast');
            }
        } else {
            let str = '';
            if (x < 0 || x > correctedMapSize) {
                str +=
                    x < 0
                        ? client.intlGet(rustplus.guildId, 'westOfGrid')
                        : client.intlGet(rustplus.guildId, 'eastOfGrid');
                str += ` ${getGridPosNumberY(y, correctedMapSize)}`;
            } else {
                str +=
                    y < 0
                        ? client.intlGet(rustplus.guildId, 'southOfGrid')
                        : client.intlGet(rustplus.guildId, 'northOfGrid');
                str += ` ${getGridPosLettersX(x, correctedMapSize)}`;
            }
            pos.location = str;
        }
    } else {
        pos.location = getGridPos(x, y, mapSize);
    }

    if (rustplus?.map?.monuments && rustplus?.map?.monumentInfo) {
        for (const monument of rustplus.map.monuments) {
            if (monument.token === 'DungeonBase') continue;
            if (!Object.prototype.hasOwnProperty.call(rustplus.map.monumentInfo, monument.token)) continue;

            if (
                getDistance(x, y, monument.x, monument.y) <=
                rustplus.map.monumentInfo[monument.token].radius
            ) {
                pos.monument = rustplus.map.monumentInfo[monument.token].clean;
                break;
            }
        }
    }

    pos.string = `${pos.location}${pos.monument !== null ? ` (${pos.monument})` : ''}`;
    return pos;
}

export function getGridPos(x: number, y: number, mapSize: number) {
    if (isOutsideGridSystem(x, y, mapSize)) return null;

    const gridPosLetters = getGridPosLettersX(x, mapSize);
    const gridPosNumber = getGridPosNumberY(y, mapSize);

    return gridPosLetters + gridPosNumber;
}

export function getGridPosLettersX(x: number, mapSize: number) {
    const numberOfGrids = getNumberOfGrids(mapSize);
    const gridDiameter = mapSize / numberOfGrids;

    let grid;
    for (grid = 0; grid < numberOfGrids; grid++) {
        if (grid === (numberOfGrids - 1) || x > mapSize) break;

        const left = grid * gridDiameter;
        const right = left + gridDiameter;

        if ((x + MARGIN) < right) break;
    }
    return numberToLetters(grid + 1);
}

export function getGridPosNumberY(y: number, mapSize: number) {
    const numberOfGrids = getNumberOfGrids(mapSize);
    const gridDiameter = mapSize / numberOfGrids;

    let grid;
    for (grid = 0; grid < numberOfGrids; grid++) {
        if (grid === (numberOfGrids - 1) || y > mapSize) break;

        const upper = mapSize - (grid * gridDiameter);
        const lower = upper - gridDiameter;

        if ((y - MARGIN) > lower) break;
    }
    return grid;
}

export function numberToLetters(num: number): string {
    const mod = num % 26;
    let pow = (num / 26) | 0;
    const out = mod ? String.fromCharCode(64 + mod) : (pow--, 'Z');
    return pow ? numberToLetters(pow) + out : out;
}

export function getCorrectedMapSize(mapSize: number) {
    const remainder = mapSize % gridDiameter;
    const offset = gridDiameter - remainder;
    return remainder < 120 ? mapSize - remainder : mapSize + offset;
}

export function getAngleBetweenPoints(x1: number, y1: number, x2: number, y2: number) {
    let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

    if (angle < 0) {
        angle = 360 + angle;
    }

    return Math.floor((Math.abs(angle - 360) + 90) % 360);
}

export function getDistance(x1: number, y1: number, x2: number, y2: number) {
    const a = x1 - x2;
    const b = y1 - y2;
    return Math.sqrt(a * a + b * b);
}

export function isOutsideGridSystem(x: number, y: number, mapSize: number, offset = 0) {
    if (x < -offset || x > mapSize + offset || y < -offset || y > mapSize + offset) {
        return true;
    }
    return false;
}

export function isOutsideRowOrColumn(x: number, y: number, mapSize: number) {
    return (
        (x < 0 && y > mapSize) ||
        (x < 0 && y < 0) ||
        (x > mapSize && y > mapSize) ||
        (x > mapSize && y < 0)
    );
}
