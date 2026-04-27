import Items from './Items.js';
import getStaticFilesStorage from '../util/getStaticFilesStorage.js';
import { findClosestString } from '../util/utils.js';

const IGNORED_RECYCLE_ITEMS = ['-946369541' /* Low Grade Fuel */];

interface DatasetView {
    getEntry(id: string | number): unknown | null;
    getDatasetObject(): Record<string, unknown>;
    getKeys(): string[];
    hasEntry(id: string | number): boolean;
}

interface GroupedDatasetView extends DatasetView {
    getEntry(id: string | number, group: string): unknown | null;
    getDatasetObject(group: string): Record<string, unknown>;
    getKeys(group: string): string[];
    hasEntry(id: string | number, group: string): boolean;
}

export default class RustLabs {
    private _staticStorage = getStaticFilesStorage();
    private _craftData: DatasetView;
    private _researchData: DatasetView;
    private _recycleData: DatasetView;
    private _durabilityData: GroupedDatasetView;
    private _smeltingData: DatasetView;
    private _despawnData: DatasetView;
    private _stackData: DatasetView;
    private _decayData: GroupedDatasetView;
    private _upkeepData: GroupedDatasetView;
    private _items = new Items();
    private _rustlabsBuildingBlocks: DatasetView;
    private _rustlabsOther: DatasetView;
    private _durabilityGroups = ['explosive', 'melee', 'throw', 'guns', 'torpedo', 'turret'];
    private _durabilityWhich = ['hard', 'soft', 'both'];
    private _orderedBy = [
        'quantityHighFirst',
        'quantityLowFirst',
        'timeHighFirst',
        'timeLowFirst',
        'fuelHighFirst',
        'fuelLowFirst',
        'sulfurHighFirst',
        'sulfurLowFirst',
    ];
    private _buildingBlocks: string[];
    private _other: string[];

    constructor() {
        this._craftData = this.createDatasetView('rustlabsCraftData');
        this._researchData = this.createDatasetView('rustlabsResearchData');
        this._recycleData = this.createDatasetView('rustlabsRecycleData');
        this._durabilityData = this.createGroupedDatasetView('rustlabsDurabilityData', {
            cacheValues: false,
        });
        this._smeltingData = this.createDatasetView('rustlabsSmeltingData');
        this._despawnData = this.createDatasetView('rustlabsDespawnData');
        this._stackData = this.createDatasetView('rustlabsStackData');
        this._decayData = this.createGroupedDatasetView('rustlabsDecayData');
        this._upkeepData = this.createGroupedDatasetView('rustlabsUpkeepData');

        this._rustlabsBuildingBlocks = this.createDatasetView('rustlabsBuildingBlocks');
        this._rustlabsOther = this.createDatasetView('rustlabsOther');

        this._buildingBlocks = Object.keys(this.rustlabsBuildingBlocks);
        this._other = Object.keys(this.rustlabsOther);
    }

    get craftData(): DatasetView {
        return this._craftData;
    }

    get researchData(): DatasetView {
        return this._researchData;
    }

    get recycleData(): DatasetView {
        return this._recycleData;
    }

    get durabilityData(): GroupedDatasetView {
        return this._durabilityData;
    }

    get smeltingData(): DatasetView {
        return this._smeltingData;
    }

    get despawnData(): DatasetView {
        return this._despawnData;
    }

    get stackData(): DatasetView {
        return this._stackData;
    }

    get decayData(): GroupedDatasetView {
        return this._decayData;
    }

    get upkeepData(): GroupedDatasetView {
        return this._upkeepData;
    }

    get items(): Items {
        return this._items;
    }

    get rustlabsBuildingBlocks(): DatasetView {
        return this._rustlabsBuildingBlocks;
    }

    get rustlabsOther(): DatasetView {
        return this._rustlabsOther;
    }

    get durabilityGroups(): string[] {
        return this._durabilityGroups;
    }

    get durabilityWhich(): string[] {
        return this._durabilityWhich;
    }

    get orderedBy(): string[] {
        return this._orderedBy;
    }

    get buildingBlocks(): string[] {
        return this._buildingBlocks;
    }

    get other(): string[] {
        return this._other;
    }

    private createDatasetView(dataset: string): DatasetView {
        const storage = this._staticStorage;
        return {
            getEntry: (id: string | number) => storage.getEntry(dataset, id),
            getDatasetObject: () => storage.getDatasetObject(dataset),
            getKeys: () => storage.getKeys(dataset),
            hasEntry: (id: string | number) => storage.hasEntry(dataset, id),
        };
    }

    private createGroupedDatasetView(
        dataset: string,
        options: { cacheValues?: boolean } = {},
    ): GroupedDatasetView {
        const storage = this._staticStorage;
        const cache = options.cacheValues !== false ? new Map<string, unknown>() : null;

        return {
            getEntry: (id: string | number, group = '') => {
                const cacheKey = `${dataset}:${group}:${id}`;
                if (cache?.has(cacheKey)) {
                    return cache.get(cacheKey) ?? null;
                }
                const value = storage.getEntry(dataset, id, group);
                if (cache && value !== null) {
                    cache.set(cacheKey, value);
                }
                return value;
            },
            getDatasetObject: (group = '') => storage.getDatasetObject(dataset, group) as Record<string, unknown>,
            getKeys: (group = '') => storage.getKeys(dataset, group),
            hasEntry: (id: string | number, group = '') => storage.hasEntry(dataset, id, group),
        };
    }

    getRecycleData(id: string): Array<{ id: string; quantity: number }> | null {
        if (!this.recycleData.hasEntry(id)) return null;
        const data = this.recycleData.getEntry(id) as Array<{ id: string; quantity: number }> | null;
        if (!data) return null;
        return data.filter((item) => !IGNORED_RECYCLE_ITEMS.includes(item.id));
    }

    getClosestRecycleItemIdByName(name: string): string | null {
        const itemNames = Object.keys(this.recycleData.getDatasetObject()).map(
            (id) => this.items.getName(id) ?? '',
        );
        const closestName = findClosestString(name, itemNames);
        if (closestName === null) return null;
        return this.items.getIdByName(closestName) ?? null;
    }
}
