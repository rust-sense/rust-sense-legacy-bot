import fs from 'node:fs';
import Gm from 'gm';
import Jimp from 'jimp';

import * as Constants from '../util/constants.js';
import { client } from '../index.js';
import { cwdPath } from '../utils/filesystemUtils.js';

interface Monument {
    token?: string;
    x: number;
    y: number;
}

interface MapData {
    width: number;
    height: number;
    jpgImage: string;
    oceanMargin: number;
    monuments: Monument[];
    background: string;
}

interface RustplusLike {
    guildId: string;
    serverId: string;
}

interface MapMarkerImageMeta {
    image: string;
    size: number | null;
    type: number | null;
    jimp: Jimp | null;
}

interface MonumentInfo {
    clean: string;
    map: string;
    radius: number;
}

export default class GameMap {
    private _width: number;
    private _height: number;
    private _oceanMargin: number;
    private _monuments: Monument[];
    private _background: string;
    private _rustplus: RustplusLike;
    private _font: Jimp | null = null;
    private _mapMarkerImageMeta: Record<string, MapMarkerImageMeta>;
    private _monumentInfo: Record<string, MonumentInfo>;

    constructor(map: MapData, rustplus: RustplusLike) {
        this._width = map.width;
        this._height = map.height;
        client.rustplusMaps[rustplus.guildId] = map.jpgImage;
        this._oceanMargin = map.oceanMargin;
        this._monuments = map.monuments;
        this._background = map.background;

        this._rustplus = rustplus;

        this._mapMarkerImageMeta = {
            map: {
                image: cwdPath(`maps/${this.rustplus.guildId}_map_clean.png`),
                size: null,
                type: null,
                jimp: null,
            },
            player: {
                image: cwdPath('resources/images/markers/player.png'),
                size: 20,
                type: 1,
                jimp: null,
            },
            shop: {
                image: cwdPath('resources/images/markers/shop.png'),
                size: 20,
                type: 3,
                jimp: null,
            },
            chinook: {
                image: cwdPath('resources/images/markers/chinook.png'),
                size: 50,
                type: 4,
                jimp: null,
            },
            cargo: {
                image: cwdPath('resources/images/markers/cargo.png'),
                size: 100,
                type: 5,
                jimp: null,
            },
            blade: {
                image: cwdPath('resources/images/markers/blade.png'),
                size: 25,
                type: 7,
                jimp: null,
            },
            heli: {
                image: cwdPath('resources/images/markers/heli.png'),
                size: 20,
                type: 8,
                jimp: null,
            },
            tunnels: {
                image: cwdPath('resources/images/markers/tunnels.png'),
                size: 35,
                type: 9,
                jimp: null,
            },
            tunnels_link: {
                image: cwdPath('resources/images/markers/tunnels_link.png'),
                size: 35,
                type: 10,
                jimp: null,
            },
        };

        this._monumentInfo = {
            AbandonedMilitaryBase: {
                clean: client.intlGet(rustplus.guildId, 'abandonedMilitaryBase'),
                map: client.intlGet(rustplus.guildId, 'abandonedMilitaryBase').toUpperCase(),
                radius: 46,
            },
            airfield_display_name: {
                clean: client.intlGet(rustplus.guildId, 'airfield'),
                map: client.intlGet(rustplus.guildId, 'airfield').toUpperCase(),
                radius: 120,
            },
            arctic_base_a: {
                clean: client.intlGet(rustplus.guildId, 'arcticResearchBase'),
                map: client.intlGet(rustplus.guildId, 'arcticResearchBase').toUpperCase(),
                radius: 64,
            },
            bandit_camp: {
                clean: client.intlGet(rustplus.guildId, 'banditCamp'),
                map: client.intlGet(rustplus.guildId, 'banditCamp').toUpperCase(),
                radius: 82,
            },
            // ... (rest of monument info)
        };

        this.setupMapMarkers();
    }

    get width(): number {
        return this._width;
    }
    get height(): number {
        return this._height;
    }
    get oceanMargin(): number {
        return this._oceanMargin;
    }
    get monuments(): Monument[] {
        return this._monuments;
    }
    get background(): string {
        return this._background;
    }
    get rustplus(): RustplusLike {
        return this._rustplus;
    }
    get font(): Jimp | null {
        return this._font;
    }
    get mapMarkerImageMeta(): Record<string, MapMarkerImageMeta> {
        return this._mapMarkerImageMeta;
    }
    get monumentInfo(): Record<string, MonumentInfo> {
        return this._monumentInfo;
    }

    static getPos(x: number, y: number, mapSize: number, _rustplus?: RustplusLike): string {
        const correctedMapSize = GameMap.getCorrectedMapSize(mapSize);
        const gridSize = correctedMapSize / 7;
        const gridChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);

        if (gridX < 0 || gridX >= 7 || gridY < 0 || gridY >= 7) {
            return '';
        }

        return `${gridChar[gridX]}${gridY + 1}`;
    }

    static getCorrectedMapSize(mapSize: number): number {
        const gridSize = mapSize / 7;
        return Math.floor(gridSize) * 7;
    }

    static async getMapImage(rustplus: RustplusLike): Promise<Buffer | null> {
        const mapImage = client.rustplusMaps[rustplus.guildId];
        if (!mapImage) return null;
        return Buffer.from(mapImage as string, 'base64');
    }

    async setupMapMarkers(): Promise<void> {
        /* Implementation */
    }
}
