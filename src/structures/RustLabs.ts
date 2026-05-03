import getStaticFilesStorage from '../infrastructure/getStaticFilesStorage.js';
import { findClosestString } from '../utils/stringUtils.js';
import Items from './Items.js';

const IGNORED_RECYCLE_ITEMS = ['-946369541' /* Low Grade Fuel */];

interface DatasetView {
    getEntry(id: string | number): unknown | null;
    getDatasetObject(): Record<string, unknown>;
    getKeys(): string[];
    hasEntry(id: string | number): boolean;
}

interface GroupedDatasetView extends DatasetView {
    getEntry(id: string | number, group?: string): unknown | null;
    getDatasetObject(group?: string): Record<string, unknown>;
    getKeys(group?: string): string[];
    hasEntry(id: string | number, group?: string): boolean;
}

export default class RustLabs {
    [key: string]: any;

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

    private createGroupedDatasetView(dataset: string, options: { cacheValues?: boolean } = {}): GroupedDatasetView {
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
        const itemNames = Object.keys(this.recycleData.getDatasetObject()).map((id) => this.items.getName(id) ?? '');
        const closestName = findClosestString(name, itemNames);
        if (closestName === null) return null;
        return this.items.getIdByName(closestName) ?? null;
    }

    getDurabilityGroups(): string[] {
        return this.durabilityGroups;
    }

    getDurabilityWhich(): string[] {
        return this.durabilityWhich;
    }

    getOrderedBy(): string[] {
        return this.orderedBy;
    }

    getClosestBuildingBlockNameByName(name: string): string | null {
        return findClosestString(name, this.buildingBlocks);
    }

    getClosestOtherNameByName(name: string): string | null {
        return findClosestString(name, this.other);
    }

    getArrayOrderedBy(array: any[], key: string, orderedByLow: boolean): any[] {
        if (orderedByLow) {
            return array.sort((a, b) => a[key] - b[key]);
        } else {
            return array.sort((a, b) => b[key] - a[key]);
        }
    }

    getArrayOrderedByChoice(array: any[], orderedBy: string | null = null): any[] {
        switch (orderedBy) {
            case 'quantityHighFirst':
                return this.getArrayOrderedBy(array, 'quantity', false);
            case 'quantityLowFirst':
                return this.getArrayOrderedBy(array, 'quantity', true);
            case 'timeHighFirst':
                return this.getArrayOrderedBy(array, 'time', false);
            case 'timeLowFirst':
                return this.getArrayOrderedBy(array, 'time', true);
            case 'fuelHighFirst':
                return this.getArrayOrderedBy(array, 'fuel', false);
            case 'fuelLowFirst':
                return this.getArrayOrderedBy(array, 'fuel', true);
            case 'sulfurHighFirst':
                return this.getArrayOrderedBy(array, 'sulfur', false);
            case 'sulfurLowFirst':
                return this.getArrayOrderedBy(array, 'sulfur', true);
            default:
                return array;
        }
    }

    hasCraftDetails(itemId: string): boolean {
        return this.craftData.hasEntry(itemId);
    }

    getCraftDetailsByName(name: string): any[] | null {
        if (typeof name !== 'string') return null;
        const id = this.items.getClosestItemIdByName(name);
        if (!id) return null;
        return this.getCraftDetailsById(id);
    }

    getCraftDetailsById(id: string): any[] | null {
        if (!this.hasCraftDetails(id)) return null;
        return [id, this.items.items[id], this.craftData.getEntry(id)];
    }

    hasResearchDetails(itemId: string): boolean {
        return this.researchData.hasEntry(itemId);
    }

    getResearchDetailsByName(name: string): any[] | null {
        if (typeof name !== 'string') return null;
        const id = this.items.getClosestItemIdByName(name);
        if (!id) return null;
        return this.getResearchDetailsById(id);
    }

    getResearchDetailsById(id: string): any[] | null {
        if (!this.hasResearchDetails(id)) return null;
        return [id, this.items.items[id], this.researchData.getEntry(id)];
    }

    hasRecycleDetails(itemId: string): boolean {
        return this.recycleData.hasEntry(itemId);
    }

    getRecycleDetailsByName(name: string): any[] | null {
        if (typeof name !== 'string') return null;
        const id = this.items.getClosestItemIdByName(name);
        if (!id) return null;
        return this.getRecycleDetailsById(id);
    }

    getRecycleDetailsById(id: string): any[] | null {
        if (typeof id !== 'string') return null;
        if (!this.hasRecycleDetails(id)) return null;
        return [id, this.items.items[id], this.recycleData.getEntry(id)];
    }

    getRecycleDataFromArray(
        items: Array<{ itemId: string | number; quantity: number; itemIsBlueprint: boolean }>,
    ): Record<string, any[]> {
        const mergedItems: Array<{ itemId: string; quantity: number; itemIsBlueprint: boolean }> = [];
        for (const item of items) {
            const itemId = typeof item.itemId === 'string' ? item.itemId : item.itemId.toString();
            const found = mergedItems.find((e) => e.itemId === itemId && e.itemIsBlueprint === item.itemIsBlueprint);
            if (found === undefined) {
                mergedItems.push({ itemId, quantity: item.quantity, itemIsBlueprint: item.itemIsBlueprint });
            } else {
                found.quantity += item.quantity;
            }
        }

        const recycleData: Record<string, any[]> = {
            recycler: [],
            shredder: [],
            'safe-zone-recycler': [],
        };

        for (const recyclerType of Object.keys(recycleData)) {
            let recycledItems = mergedItems.slice();
            while (true) {
                let noMoreIterations = true;
                const expandedItems: typeof mergedItems = [];

                for (const item of recycledItems) {
                    if (!this.hasRecycleDetails(item.itemId)) {
                        expandedItems.push(item);
                        continue;
                    }
                    const entryYield = (this.recycleData.getEntry(item.itemId) as any)[recyclerType]['yield'] as any[];
                    if (
                        entryYield.length > 0 &&
                        !item.itemIsBlueprint &&
                        !IGNORED_RECYCLE_ITEMS.includes(item.itemId)
                    ) {
                        noMoreIterations = false;
                        for (const recycleItem of entryYield) {
                            for (let i = 0; i < item.quantity; i++) {
                                if (recycleItem.probability < 1 && Math.random() > recycleItem.probability) continue;
                                const found = expandedItems.find((e) => e.itemId === recycleItem.id);
                                if (found === undefined) {
                                    expandedItems.push({
                                        itemId: recycleItem.id,
                                        quantity: recycleItem.quantity,
                                        itemIsBlueprint: false,
                                    });
                                } else {
                                    found.quantity += recycleItem.quantity;
                                }
                            }
                        }
                    } else {
                        const found = expandedItems.find(
                            (e) => e.itemId === item.itemId && e.itemIsBlueprint === item.itemIsBlueprint,
                        );
                        if (found === undefined) {
                            expandedItems.push(item);
                        } else {
                            found.quantity += item.quantity;
                        }
                    }
                }

                recycledItems = expandedItems;
                if (noMoreIterations) break;
            }
            recycleData[recyclerType] = recycledItems;
        }

        return recycleData;
    }

    hasDurabilityDetails(itemIdOrName: string): boolean {
        return (
            this.durabilityData.hasEntry(itemIdOrName, 'items') ||
            this.durabilityData.hasEntry(itemIdOrName, 'buildingBlocks') ||
            this.durabilityData.hasEntry(itemIdOrName, 'other')
        );
    }

    getDurabilityDetailsByName(
        name: string,
        group: string | null = null,
        which: string | null = null,
        orderedBy: string | null = null,
    ): any[] | null {
        if (typeof name !== 'string') return null;
        if (group !== null && !this.durabilityGroups.includes(group)) return null;
        if (which !== null && !this.durabilityWhich.includes(which)) return null;
        if (orderedBy !== null && !this.orderedBy.includes(orderedBy)) return null;

        let type: string | null = null;
        let foundName: string | null = null;

        if (!foundName) {
            foundName = this.getClosestOtherNameByName(name);
            if (foundName) {
                if (this.durabilityData.hasEntry(foundName, 'other')) {
                    type = 'other';
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) {
            foundName = this.getClosestBuildingBlockNameByName(name);
            if (foundName) {
                if (this.durabilityData.hasEntry(foundName, 'buildingBlocks')) {
                    type = 'buildingBlocks';
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) {
            foundName = this.items.getClosestItemIdByName(name);
            if (foundName) {
                if (this.durabilityData.hasEntry(foundName, 'items')) {
                    return this.getDurabilityDetailsById(foundName, group, which, orderedBy);
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) return null;

        let content: any[] = [...(this.durabilityData.getEntry(foundName, type!) as any[])];
        content = content.filter((item) => {
            if (group !== null && item.group !== group) return false;
            if (which !== null && item.which !== which) return false;
            return true;
        });
        content = this.getArrayOrderedByChoice(content, orderedBy);
        return [type, foundName, foundName, content];
    }

    getDurabilityDetailsById(
        id: string,
        group: string | null = null,
        which: string | null = null,
        orderedBy: string | null = null,
    ): any[] | null {
        if (typeof id !== 'string') return null;
        if (!this.hasDurabilityDetails(id)) return null;
        if (group !== null && !this.durabilityGroups.includes(group)) return null;
        if (which !== null && !this.durabilityWhich.includes(which)) return null;
        if (orderedBy !== null && !this.orderedBy.includes(orderedBy)) return null;

        let content: any[] = [...(this.durabilityData.getEntry(id, 'items') as any[])];
        content = content.filter((item) => {
            if (group !== null && item.group !== group) return false;
            if (which !== null && item.which !== which) return false;
            return true;
        });
        content = this.getArrayOrderedByChoice(content, orderedBy);
        return ['items', id, this.items.items[id], content];
    }

    hasSmeltingDetails(itemId: string): boolean {
        return this.smeltingData.hasEntry(itemId);
    }

    getSmeltingDetailsByName(name: string): any[] | null {
        if (typeof name !== 'string') return null;
        const id = this.items.getClosestItemIdByName(name);
        if (!id) return null;
        return this.getSmeltingDetailsById(id);
    }

    getSmeltingDetailsById(id: string): any[] | null {
        if (!this.hasSmeltingDetails(id)) return null;
        return [id, this.items.items[id], this.smeltingData.getEntry(id)];
    }

    getSmeltingDetailsFromParameterById(id: string): Record<string, any[]> | null {
        if (!this.items.itemExist(id)) return null;
        const fromParameterSmeltingDetails: Record<string, any[]> = {};
        for (const [smeltingTool, smeltingDetails] of Object.entries(this.smeltingData.getDatasetObject())) {
            for (const details of smeltingDetails as any[]) {
                if (details.fromId === id) {
                    if (!Object.hasOwn(fromParameterSmeltingDetails, smeltingTool)) {
                        fromParameterSmeltingDetails[smeltingTool] = [];
                    }
                    fromParameterSmeltingDetails[smeltingTool].push(details);
                }
            }
        }
        return fromParameterSmeltingDetails;
    }

    hasDespawnDetails(itemId: string): boolean {
        return this.despawnData.hasEntry(itemId);
    }

    getDespawnDetailsByName(name: string): any[] | null {
        if (typeof name !== 'string') return null;
        const id = this.items.getClosestItemIdByName(name);
        if (!id) return null;
        return this.getDespawnDetailsById(id);
    }

    getDespawnDetailsById(id: string): any[] | null {
        if (!this.hasDespawnDetails(id)) return null;
        return [id, this.items.items[id], this.despawnData.getEntry(id)];
    }

    hasStackDetails(itemId: string): boolean {
        return this.stackData.hasEntry(itemId);
    }

    getStackDetailsByName(name: string): any[] | null {
        if (typeof name !== 'string') return null;
        const id = this.items.getClosestItemIdByName(name);
        if (!id) return null;
        return this.getStackDetailsById(id);
    }

    getStackDetailsById(id: string): any[] | null {
        if (!this.hasStackDetails(id)) return null;
        return [id, this.items.items[id], this.stackData.getEntry(id)];
    }

    hasDecayDetails(itemIdOrName: string): boolean {
        return (
            this.decayData.hasEntry(itemIdOrName, 'items') ||
            this.decayData.hasEntry(itemIdOrName, 'buildingBlocks') ||
            this.decayData.hasEntry(itemIdOrName, 'other')
        );
    }

    getDecayDetailsByName(name: string): any[] | null {
        if (typeof name !== 'string') return null;

        let type: string | null = null;
        let foundName: string | null = null;

        if (!foundName) {
            foundName = this.getClosestOtherNameByName(name);
            if (foundName) {
                if (this.decayData.hasEntry(foundName, 'other')) {
                    type = 'other';
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) {
            foundName = this.getClosestBuildingBlockNameByName(name);
            if (foundName) {
                if (this.decayData.hasEntry(foundName, 'buildingBlocks')) {
                    type = 'buildingBlocks';
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) {
            foundName = this.items.getClosestItemIdByName(name);
            if (foundName) {
                if (this.decayData.hasEntry(foundName, 'items')) {
                    return this.getDecayDetailsById(foundName);
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) return null;
        return [type, foundName, foundName, this.decayData.getEntry(foundName, type!)];
    }

    getDecayDetailsById(id: string): any[] | null {
        if (typeof id !== 'string') return null;
        if (!this.hasDecayDetails(id)) return null;
        return ['items', id, this.items.items[id], this.decayData.getEntry(id, 'items')];
    }

    hasUpkeepDetails(itemIdOrName: string): boolean {
        return (
            this.upkeepData.hasEntry(itemIdOrName, 'items') ||
            this.upkeepData.hasEntry(itemIdOrName, 'buildingBlocks') ||
            this.upkeepData.hasEntry(itemIdOrName, 'other')
        );
    }

    getUpkeepDetailsByName(name: string): any[] | null {
        if (typeof name !== 'string') return null;

        let type: string | null = null;
        let foundName: string | null = null;

        if (!foundName) {
            foundName = this.getClosestOtherNameByName(name);
            if (foundName) {
                if (this.upkeepData.hasEntry(foundName, 'other')) {
                    type = 'other';
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) {
            foundName = this.getClosestBuildingBlockNameByName(name);
            if (foundName) {
                if (this.upkeepData.hasEntry(foundName, 'buildingBlocks')) {
                    type = 'buildingBlocks';
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) {
            foundName = this.items.getClosestItemIdByName(name);
            if (foundName) {
                if (this.upkeepData.hasEntry(foundName, 'items')) {
                    return this.getUpkeepDetailsById(foundName);
                } else {
                    foundName = null;
                }
            }
        }

        if (!foundName) return null;
        return [type, foundName, foundName, this.upkeepData.getEntry(foundName, type!)];
    }

    getUpkeepDetailsById(id: string): any[] | null {
        if (typeof id !== 'string') return null;
        if (!this.hasUpkeepDetails(id)) return null;
        return ['items', id, this.items.items[id], this.upkeepData.getEntry(id, 'items')];
    }
}
