import Fs from 'fs';

import Path from 'path';
import Utils from '../util/utils.js';

class Items {
    _itemNames: any;
    _items: any;
    constructor() {
        this._items = JSON.parse(Fs.readFileSync(Path.join(__dirname, '..', 'staticFiles', 'items.json'), 'utf8'));

        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        this._itemNames = Object.values(this.items).map((item) => item.name);
    }

    /* Getters */
    get items() {
        return this._items;
    }
    get itemNames() {
        return this._itemNames;
    }

    addItem(id, content) {
        this.items[id] = content;
    }
    removeItem(id) {
        delete this.items[id];
    }
    itemExist(id) {
        return id in this.items ? true : false;
    }

    getShortName(id) {
        if (!this.itemExist(id)) return undefined;
        return this.items[id].shortname;
    }

    getName(id) {
        if (!this.itemExist(id)) return undefined;
        return this.items[id].name;
    }

    getDescription(id) {
        if (!this.itemExist(id)) return undefined;
        return this.items[id].description;
    }

    getIdByName(name) {
        return Object.keys(this.items).find((id) => this.items[id].name === name);
    }

    getClosestItemIdByName(name) {
        const closestString = Utils.findClosestString(name, this.itemNames);
        if (closestString !== null) {
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            const id = Object.entries(this.items).find(([key, value]) => value.name === closestString);
            return id ? id[0] : null;
        }
        return null;
    }
}

export default Items;
