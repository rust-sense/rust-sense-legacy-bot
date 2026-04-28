// @ts-nocheck
import { client } from '../index.js';

const GRID_DIAMETER = 146.28571;
const MARGIN = 1;

function getNumberOfGrids(mapSize) {
    const n = Math.floor(mapSize / GRID_DIAMETER);
    return Math.max(1, n);
}

module.exports = {
    gridDiameter: GRID_DIAMETER,

    getPos: function (x, y, mapSize, rustplus) {
        const correctedMapSize = module.exports.getCorrectedMapSize(mapSize);
        const pos = { location: null, monument: null, string: null, x: x, y: y };

        if (module.exports.isOutsideGridSystem(x, y, correctedMapSize)) {
            if (module.exports.isOutsideRowOrColumn(x, y, correctedMapSize)) {
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
                    str += ` ${module.exports.getGridPosNumberY(y, correctedMapSize)}`;
                } else {
                    str +=
                        y < 0
                            ? client.intlGet(rustplus.guildId, 'southOfGrid')
                            : client.intlGet(rustplus.guildId, 'northOfGrid');
                    str += ` ${module.exports.getGridPosLettersX(x, correctedMapSize)}`;
                }
                pos.location = str;
            }
        } else {
            pos.location = module.exports.getGridPos(x, y, mapSize);
        }

        if (rustplus?.map?.monuments && rustplus?.map?.monumentInfo) {
            for (const monument of rustplus.map.monuments) {
                if (monument.token === 'DungeonBase') continue;
                if (!Object.prototype.hasOwnProperty.call(rustplus.map.monumentInfo, monument.token)) continue;

                if (
                    module.exports.getDistance(x, y, monument.x, monument.y) <=
                    rustplus.map.monumentInfo[monument.token].radius
                ) {
                    pos.monument = rustplus.map.monumentInfo[monument.token].clean;
                    break;
                }
            }
        }

        pos.string = `${pos.location}${pos.monument !== null ? ` (${pos.monument})` : ''}`;
        return pos;
    },

    getGridPos: function (x, y, mapSize) {
        if (module.exports.isOutsideGridSystem(x, y, mapSize)) return null;

        const gridPosLetters = module.exports.getGridPosLettersX(x, mapSize);
        const gridPosNumber = module.exports.getGridPosNumberY(y, mapSize);

        return gridPosLetters + gridPosNumber;
    },

    getGridPosLettersX: function (x, mapSize) {
        const numberOfGrids = getNumberOfGrids(mapSize);
        const gridDiameter = mapSize / numberOfGrids;

        let grid;
        for (grid = 0; grid < numberOfGrids; grid++) {
            if (grid === (numberOfGrids - 1) || x > mapSize) break;

            const left = grid * gridDiameter;
            const right = left + gridDiameter;

            if ((x + MARGIN) < right) break;
        }
        return module.exports.numberToLetters(grid + 1);
    },

    getGridPosNumberY: function (y, mapSize) {
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
    },

    numberToLetters: function (num) {
        const mod = num % 26;
        let pow = (num / 26) | 0;
        const out = mod ? String.fromCharCode(64 + mod) : (pow--, 'Z');
        return pow ? module.exports.numberToLetters(pow) + out : out;
    },

    getCorrectedMapSize: function (mapSize) {
        const remainder = mapSize % module.exports.gridDiameter;
        const offset = module.exports.gridDiameter - remainder;
        return remainder < 120 ? mapSize - remainder : mapSize + offset;
    },

    getAngleBetweenPoints: function (x1, y1, x2, y2) {
        let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

        if (angle < 0) {
            angle = 360 + angle;
        }

        return Math.floor((Math.abs(angle - 360) + 90) % 360);
    },

    getDistance: function (x1, y1, x2, y2) {
        const a = x1 - x2;
        const b = y1 - y2;
        return Math.sqrt(a * a + b * b);
    },

    isOutsideGridSystem: function (x, y, mapSize, offset = 0) {
        if (x < -offset || x > mapSize + offset || y < -offset || y > mapSize + offset) {
            return true;
        }
        return false;
    },

    isOutsideRowOrColumn: function (x, y, mapSize) {
        return (
            (x < 0 && y > mapSize) ||
            (x < 0 && y < 0) ||
            (x > mapSize && y > mapSize) ||
            (x > mapSize && y < 0)
        );
    },
};
