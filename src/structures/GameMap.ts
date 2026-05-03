import fs from 'node:fs';
import Gm from 'gm';
import { Jimp, loadFont } from 'jimp';

type JimpImage = Awaited<ReturnType<typeof Jimp.read>>;
type JimpFont = Awaited<ReturnType<typeof loadFont>>;

import * as Constants from '../domain/constants.js';
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

interface MapTypes {
    Player: number;
    VendingMachine: number;
    CH47: number;
    CargoShip: number;
    GenericRadius: number;
    PatrolHelicopter: number;
    TravelingVendor: number;
    [key: string]: number;
}

interface RustplusLike {
    guildId: string;
    serverId: string;
    info: { mapSize: number } | null;
    mapMarkers: { types: MapTypes } | null;
    cargoShipTracers: Record<string, Array<{ x: number; y: number }>>;
    patrolHelicopterTracers: Record<string, Array<{ x: number; y: number }>>;
    generalSettings: { language: string };
    log(type: string, msg: string, level?: string): void;
    getMapMarkersAsync(): Promise<any>;
    isResponseValid(response: any): boolean;
}

interface MapMarkerImageMeta {
    image: string;
    size: number | null;
    type: number | null;
    jimp: JimpImage | null;
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
    private _font: JimpFont | null = null;
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
            dome_monument_name: {
                clean: client.intlGet(rustplus.guildId, 'theDome'),
                map: client.intlGet(rustplus.guildId, 'theDome').toUpperCase(),
                radius: 50,
            },
            excavator: {
                clean: client.intlGet(rustplus.guildId, 'giantExcavatorPit'),
                map: client.intlGet(rustplus.guildId, 'giantExcavatorPit').toUpperCase(),
                radius: 110,
            },
            ferryterminal: {
                clean: client.intlGet(rustplus.guildId, 'ferryTerminal'),
                map: client.intlGet(rustplus.guildId, 'ferryTerminal').toUpperCase(),
                radius: 88,
            },
            fishing_village_display_name: {
                clean: client.intlGet(rustplus.guildId, 'fishingVillage'),
                map: client.intlGet(rustplus.guildId, 'fishingVillage').toUpperCase(),
                radius: 31,
            },
            gas_station: {
                clean: client.intlGet(rustplus.guildId, 'oxumsGasStation'),
                map: client.intlGet(rustplus.guildId, 'oxumsGasStation').toUpperCase(),
                radius: 28,
            },
            harbor_2_display_name: {
                clean: client.intlGet(rustplus.guildId, 'harbor'),
                map: client.intlGet(rustplus.guildId, 'harbor').toUpperCase(),
                radius: 96,
            },
            harbor_display_name: {
                clean: client.intlGet(rustplus.guildId, 'harbor'),
                map: client.intlGet(rustplus.guildId, 'harbor').toUpperCase(),
                radius: 96,
            },
            junkyard_display_name: {
                clean: client.intlGet(rustplus.guildId, 'junkyard'),
                map: client.intlGet(rustplus.guildId, 'junkyard').toUpperCase(),
                radius: 88,
            },
            large_fishing_village_display_name: {
                clean: client.intlGet(rustplus.guildId, 'largeFishingVillage'),
                map: client.intlGet(rustplus.guildId, 'largeFishingVillage').toUpperCase(),
                radius: 40,
            },
            large_oil_rig: {
                clean: client.intlGet(rustplus.guildId, 'largeOilRig'),
                map: client.intlGet(rustplus.guildId, 'largeOilRig').toUpperCase(),
                radius: 40,
            },
            launchsite: {
                clean: client.intlGet(rustplus.guildId, 'launchSite'),
                map: client.intlGet(rustplus.guildId, 'launchSite').toUpperCase(),
                radius: 250,
            },
            lighthouse_display_name: {
                clean: client.intlGet(rustplus.guildId, 'lighthouse'),
                map: client.intlGet(rustplus.guildId, 'lighthouse').toUpperCase(),
                radius: 28,
            },
            military_tunnels_display_name: {
                clean: client.intlGet(rustplus.guildId, 'militaryTunnel'),
                map: client.intlGet(rustplus.guildId, 'militaryTunnel').toUpperCase(),
                radius: 122,
            },
            mining_outpost_display_name: {
                clean: client.intlGet(rustplus.guildId, 'miningOutpost'),
                map: client.intlGet(rustplus.guildId, 'miningOutpost').toUpperCase(),
                radius: 17,
            },
            missile_silo_monument: {
                clean: client.intlGet(rustplus.guildId, 'missileSilo'),
                map: client.intlGet(rustplus.guildId, 'missileSilo').toUpperCase(),
                radius: 81,
            },
            mining_quarry_hqm_display_name: {
                clean: client.intlGet(rustplus.guildId, 'hqmQuarry'),
                map: client.intlGet(rustplus.guildId, 'hqmQuarry').toUpperCase(),
                radius: 27,
            },
            mining_quarry_stone_display_name: {
                clean: client.intlGet(rustplus.guildId, 'stoneQuarry'),
                map: client.intlGet(rustplus.guildId, 'stoneQuarry').toUpperCase(),
                radius: 35,
            },
            mining_quarry_sulfur_display_name: {
                clean: client.intlGet(rustplus.guildId, 'sulfurQuarry'),
                map: client.intlGet(rustplus.guildId, 'sulfurQuarry').toUpperCase(),
                radius: 33,
            },
            oil_rig_small: {
                clean: client.intlGet(rustplus.guildId, 'oilRig'),
                map: client.intlGet(rustplus.guildId, 'oilRig').toUpperCase(),
                radius: 32,
            },
            outpost: {
                clean: client.intlGet(rustplus.guildId, 'outpost'),
                map: client.intlGet(rustplus.guildId, 'outpost').toUpperCase(),
                radius: 81,
            },
            power_plant_display_name: {
                clean: client.intlGet(rustplus.guildId, 'powerPlant'),
                map: client.intlGet(rustplus.guildId, 'powerPlant').toUpperCase(),
                radius: 112,
            },
            satellite_dish_display_name: {
                clean: client.intlGet(rustplus.guildId, 'satelliteDish'),
                map: client.intlGet(rustplus.guildId, 'satelliteDish').toUpperCase(),
                radius: 78,
            },
            sewer_display_name: {
                clean: client.intlGet(rustplus.guildId, 'sewerBranch'),
                map: client.intlGet(rustplus.guildId, 'sewerBranch').toUpperCase(),
                radius: 87,
            },
            stables_a: {
                clean: client.intlGet(rustplus.guildId, 'ranch'),
                map: client.intlGet(rustplus.guildId, 'ranch').toUpperCase(),
                radius: 35,
            },
            stables_b: {
                clean: client.intlGet(rustplus.guildId, 'largeBarn'),
                map: client.intlGet(rustplus.guildId, 'largeBarn').toUpperCase(),
                radius: 35,
            },
            supermarket: {
                clean: client.intlGet(rustplus.guildId, 'abandonedSupermarket'),
                map: client.intlGet(rustplus.guildId, 'abandonedSupermarket').toUpperCase(),
                radius: 19,
            },
            swamp_c: {
                clean: client.intlGet(rustplus.guildId, 'abandonedCabins'),
                map: client.intlGet(rustplus.guildId, 'abandonedCabins').toUpperCase(),
                radius: 42,
            },
            train_tunnel_display_name: {
                clean: '',
                map: '',
                radius: 0,
            },
            train_tunnel_link_display_name: {
                clean: '',
                map: '',
                radius: 0,
            },
            train_yard_display_name: {
                clean: client.intlGet(rustplus.guildId, 'trainYard'),
                map: client.intlGet(rustplus.guildId, 'trainYard').toUpperCase(),
                radius: 115,
            },
            underwater_lab: {
                clean: client.intlGet(rustplus.guildId, 'underwaterLab'),
                map: client.intlGet(rustplus.guildId, 'underwaterLab').toUpperCase(),
                radius: 75,
            },
            water_treatment_plant_display_name: {
                clean: client.intlGet(rustplus.guildId, 'waterTreatmentPlant'),
                map: client.intlGet(rustplus.guildId, 'waterTreatmentPlant').toUpperCase(),
                radius: 110,
            },
        };

        this.resetImageAndMeta();
    }

    get width(): number {
        return this._width;
    }
    set width(v: number) {
        this._width = v;
    }
    get height(): number {
        return this._height;
    }
    set height(v: number) {
        this._height = v;
    }
    get oceanMargin(): number {
        return this._oceanMargin;
    }
    set oceanMargin(v: number) {
        this._oceanMargin = v;
    }
    get monuments(): Monument[] {
        return this._monuments;
    }
    set monuments(v: Monument[]) {
        this._monuments = v;
    }
    get background(): string {
        return this._background;
    }
    set background(v: string) {
        this._background = v;
    }
    get rustplus(): RustplusLike {
        return this._rustplus;
    }
    set rustplus(v: RustplusLike) {
        this._rustplus = v;
    }
    get font(): JimpFont | null {
        return this._font;
    }
    set font(v: JimpFont | null) {
        this._font = v;
    }
    get mapMarkerImageMeta(): Record<string, MapMarkerImageMeta> {
        return this._mapMarkerImageMeta;
    }
    set mapMarkerImageMeta(v: Record<string, MapMarkerImageMeta>) {
        this._mapMarkerImageMeta = v;
    }
    get monumentInfo(): Record<string, MonumentInfo> {
        return this._monumentInfo;
    }
    set monumentInfo(v: Record<string, MonumentInfo>) {
        this._monumentInfo = v;
    }

    isWidthChanged(map: MapData): boolean {
        return this.width !== map.width;
    }

    isHeightChanged(map: MapData): boolean {
        return this.height !== map.height;
    }

    isOceanMarginChanged(map: MapData): boolean {
        return this.oceanMargin !== map.oceanMargin;
    }

    isMonumentsChanged(map: MapData): boolean {
        return JSON.stringify(this.monuments) !== JSON.stringify(map.monuments);
    }

    isBackgroundChanged(map: MapData): boolean {
        return this.background !== map.background;
    }

    updateMap(map: MapData): void {
        this.width = map.width;
        this.height = map.height;
        client.rustplusMaps[this.rustplus.guildId] = map.jpgImage;
        this.oceanMargin = map.oceanMargin;
        this.monuments = map.monuments;
        this.background = map.background;
        this.resetImageAndMeta();
    }

    async resetImageAndMeta(): Promise<void> {
        await this.writeMapClean();
        await this.setupJimpFont();
        await this.setupMapMarkerImages();
    }

    writeMapClean(): void {
        fs.writeFileSync(this.mapMarkerImageMeta.map.image, client.rustplusMaps[this.rustplus.guildId] as string);
    }

    async setupJimpFont(): Promise<void> {
        if (this.rustplus.generalSettings.language === 'en') {
            this.font = await loadFont(cwdPath('resources/fonts/PermanentMarker.fnt'));
        } else {
            this.font = await loadFont(cwdPath('resources/fonts/YuGothic.fnt'));
        }
    }

    async setupMapMarkerImages(): Promise<void> {
        for (const [marker, content] of Object.entries(this.mapMarkerImageMeta)) {
            content.jimp = await Jimp.read(content.image);
            if (marker !== 'map' && content.size !== null) {
                content.jimp.resize({ w: content.size, h: content.size });
            }
        }
    }

    mapAppendMonuments(): Promise<void> {
        if (this.rustplus.info === null) {
            this.rustplus.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'couldNotAppendMapMonuments'));
            return;
        }

        for (const monument of this.monuments) {
            const x =
                monument.x * ((this.width - 2 * this.oceanMargin) / this.rustplus.info.mapSize) + this.oceanMargin;
            const n = this.height - 2 * this.oceanMargin;
            const y = this.height - (monument.y * (n / this.rustplus.info.mapSize) + this.oceanMargin);

            try {
                if (monument.token === 'train_tunnel_display_name') {
                    const size = this.mapMarkerImageMeta.tunnels.size!;
                    this.mapMarkerImageMeta.map.jimp!.composite(
                        this.mapMarkerImageMeta.tunnels.jimp!,
                        x - size / 2,
                        y - size / 2,
                    );
                } else if (monument.token === 'train_tunnel_link_display_name') {
                    const size = this.mapMarkerImageMeta.tunnels_link.size!;
                    this.mapMarkerImageMeta.map.jimp!.composite(
                        this.mapMarkerImageMeta.tunnels_link.jimp!,
                        x - size / 2,
                        y - size / 2,
                    );
                } else {
                    if (monument.token === 'DungeonBase') continue;

                    const name =
                        monument.token && Object.hasOwn(this.monumentInfo, monument.token)
                            ? this.monumentInfo[monument.token].map
                            : (monument.token ?? '');
                    const comp = name.length * 5;
                    this.mapMarkerImageMeta.map.jimp!.print({
                        font: this.font!,
                        x: x - comp,
                        y: y - 10,
                        text: name,
                    });
                }
            } catch (_e) {
                /* Ignore */
            }
        }
    }

    async mapAppendMarkers(): Promise<void> {
        if (this.rustplus.info === null) {
            this.rustplus.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'couldNotAppendMapMarkers'));
            return;
        }

        const mapMarkers = await this.rustplus.getMapMarkersAsync();
        if (!this.rustplus.isResponseValid(mapMarkers)) return;

        for (const marker of mapMarkers.mapMarkers.markers) {
            let x = marker.x * ((this.width - 2 * this.oceanMargin) / this.rustplus.info.mapSize) + this.oceanMargin;
            const n = this.height - 2 * this.oceanMargin;
            let y = this.height - (marker.y * (n / this.rustplus.info.mapSize) + this.oceanMargin);

            if (this.rustplus.mapMarkers && marker.type === this.rustplus.mapMarkers.types.CargoShip) {
                x -= 20;
                y -= 20;
            }

            try {
                const markerKey = this.getMarkerImageMetaByType(marker.type);
                if (markerKey === null) continue;
                const size = this.mapMarkerImageMeta[markerKey].size!;

                this.mapMarkerImageMeta[markerKey].jimp!.rotate(marker.rotation);
                this.mapMarkerImageMeta.map.jimp!.composite(
                    this.mapMarkerImageMeta[markerKey].jimp!,
                    x - size / 2,
                    y - size / 2,
                );
            } catch (_e) {
                /* Ignore */
            }
        }
    }

    async writeMap(markers: boolean, monuments: boolean): Promise<void> {
        await this.resetImageAndMeta();

        if (markers) await this.mapAppendMarkers();
        if (monuments) await this.mapAppendMonuments();

        await this.mapMarkerImageMeta.map.jimp!.write(
            this.mapMarkerImageMeta.map.image.replace('clean.png', 'full.png') as `${string}.${string}`,
        );

        try {
            const image = Gm(this.mapMarkerImageMeta.map.image.replace('clean.png', 'full.png'));

            if (this.rustplus.info === null) {
                this.rustplus.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'couldNotAppendMapTracers'));
                return;
            }

            if (!markers) return;

            image.stroke(Constants.COLOR_CARGO_TRACER, 2);
            for (const coords of Object.values(this.rustplus.cargoShipTracers)) {
                let prev: { x: number; y: number } | null = null;
                for (const point of coords) {
                    if (prev === null) {
                        prev = point;
                        continue;
                    }
                    const p1 = this.calculateImageXY(prev);
                    const p2 = this.calculateImageXY(point);
                    image.drawLine(p1.x, p1.y, p2.x, p2.y);
                    prev = point;
                }
            }

            image.stroke(Constants.COLOR_PATROL_HELICOPTER_TRACER, 2);
            for (const coords of Object.values(this.rustplus.patrolHelicopterTracers)) {
                let prev: { x: number; y: number } | null = null;
                for (const point of coords) {
                    if (prev === null) {
                        prev = point;
                        continue;
                    }
                    const p1 = this.calculateImageXY(prev);
                    const p2 = this.calculateImageXY(point);
                    image.drawLine(p1.x, p1.y, p2.x, p2.y);
                    prev = point;
                }
            }

            await this.gmWriteAsync(image, this.mapMarkerImageMeta.map.image.replace('clean.png', 'full.png'));
        } catch (_error) {
            this.rustplus.log(client.intlGet(null, 'warningCap'), client.intlGet(null, 'couldNotAddStepTracers'));
        }
    }

    getMarkerImageMetaByType(type: number): string | null {
        for (const [marker, content] of Object.entries(this.mapMarkerImageMeta)) {
            if (content.type === type) return marker;
        }
        return null;
    }

    getMonumentsByName(monumentName: string): Monument[] {
        return this.monuments.filter((m) => m.token === monumentName);
    }

    calculateImageXY(coords: { x: number; y: number }): { x: number; y: number } {
        const x = coords.x * ((this.width - 2 * this.oceanMargin) / this.rustplus.info!.mapSize) + this.oceanMargin;
        const n = this.height - 2 * this.oceanMargin;
        const y = this.height - (coords.y * (n / this.rustplus.info!.mapSize) + this.oceanMargin);
        return { x, y };
    }

    gmWriteAsync(image: ReturnType<typeof Gm>, path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            image.write(path, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static getPos(x: number, y: number, mapSize: number, _rustplus?: RustplusLike): string {
        const correctedMapSize = GameMap.getCorrectedMapSize(mapSize);
        const gridSize = correctedMapSize / 7;
        const gridChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);

        if (gridX < 0 || gridX >= 7 || gridY < 0 || gridY >= 7) return '';
        return `${gridChar[gridX]}${gridY + 1}`;
    }

    static getCorrectedMapSize(mapSize: number): number {
        const gridSize = mapSize / 7;
        return Math.floor(gridSize) * 7;
    }

    static getMapImage(rustplus: RustplusLike): Buffer | null {
        const mapImage = client.rustplusMaps[rustplus.guildId];
        if (!mapImage) return null;
        return Buffer.from(mapImage as string, 'base64');
    }
}
