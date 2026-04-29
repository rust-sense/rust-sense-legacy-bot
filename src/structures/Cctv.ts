import { loadJsonResourceSync } from '../utils/filesystemUtils.js';

interface CctvEntry {
    codes: string[];
    dynamic: boolean;
}

interface CctvData {
    [monument: string]: CctvEntry;
}

const cctvData = loadJsonResourceSync<CctvData>('staticFiles/cctv.json');

export default class Cctv {
    [key: string]: any;

    private cctvs: CctvData;

    constructor() {
        this.cctvs = cctvData;
    }

    getCctvList(): string[] {
        return Object.keys(this.cctvs);
    }

    getCctv(identifier: string): CctvEntry | undefined {
        return this.cctvs[identifier];
    }

    cctvExist(monument: string): boolean {
        return monument in this.cctvs;
    }

    getCodes(monument: string): string[] | undefined {
        if (!this.cctvExist(monument)) return undefined;
        return this.cctvs[monument].codes;
    }

    isDynamic(monument: string): boolean | undefined {
        if (!this.cctvExist(monument)) return undefined;
        return this.cctvs[monument].dynamic;
    }
}
