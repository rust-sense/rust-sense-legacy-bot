const Fs = require('node:fs');
const Path = require('node:path');

const { loadJsonResourceSync } = require('../utils/filesystemUtils');
const jsonCctv = loadJsonResourceSync('staticFiles/cctv.json');

class Cctv {
    constructor() {
        this._cctvs = jsonCctv;
    }

    /* Getters and Setters */
    get cctvs() {
        return this._cctvs;
    }
    set cctvs(cctvs) {
        this._cctvs = cctvs;
    }

    cctvExist(monument) {
        return monument in this.cctvs;
    }

    isDynamic(monument) {
        if (!this.cctvExist(monument)) {
            return undefined;
        }

        return this.cctvs[monument].dynamic;
    }

    getCodes(monument) {
        if (!this.cctvExist(monument)) {
            return undefined;
        }

        return this.cctvs[monument].codes;
    }
}

module.exports = Cctv;
