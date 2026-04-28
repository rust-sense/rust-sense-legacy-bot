import { loadJsonResourceSync } from '../utils/filesystemUtils.js';

interface CctvData {
    [key: string]: {
        [key: string]: string[];
    };
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

    getCctv(identifier: string): { [key: string]: string[] } | undefined {
        return this.cctvs[identifier];
    }

    searchCctv(searchTerm: string): string[] {
        const results: string[] = [];
        for (const [identifier, cctv] of Object.entries(this.cctvs)) {
            for (const [camera, _codes] of Object.entries(cctv)) {
                if (camera.toLowerCase().includes(searchTerm.toLowerCase())) {
                    results.push(`${identifier} - ${camera}`);
                }
            }
        }
        return results;
    }
}
