import { findClosestString } from '../util/utils.js';
import { loadJsonResourceSync } from '../utils/filesystemUtils.js';

interface ItemData {
    name: string;
    shortname: string;
    description: string;
}

const jsonItems = loadJsonResourceSync<Record<string, ItemData>>('staticFiles/items.json');

export default class Items {
    private _items: Record<string, ItemData>;
    private _itemNames: string[];

    constructor() {
        this._items = jsonItems;
        this._itemNames = Object.values(this.items).map((item) => item.name);
    }

    /* Getters */
    get items(): Record<string, ItemData> {
        return this._items;
    }

    get itemNames(): string[] {
        return this._itemNames;
    }

    addItem(id: string, content: ItemData): void {
        this.items[id] = content;
    }

    removeItem(id: string): void {
        delete this.items[id];
    }

    itemExist(id: string): boolean {
        return id in this.items;
    }

    getShortName(id: string): string | undefined {
        if (!this.itemExist(id)) return undefined;
        return this.items[id].shortname;
    }

    getName(id: string): string | undefined {
        if (!this.itemExist(id)) return undefined;
        return this.items[id].name;
    }

    getDescription(id: string): string | undefined {
        if (!this.itemExist(id)) return undefined;
        return this.items[id].description;
    }

    getIdByName(name: string): string | undefined {
        return Object.keys(this.items).find((id) => this.items[id].name === name);
    }

    getClosestItemIdByName(name: string): string | null {
        const closestName = findClosestString(name, this.itemNames);
        if (closestName === null) return null;
        return this.getIdByName(closestName);
    }
}
