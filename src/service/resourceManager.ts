import fs from 'node:fs';
import path from 'node:path';

export const APP_STATE_DIR_NAMES = ['logs', 'instances', 'credentials', 'maps'] as const;

export function getAppDir(...paths: string[]) {
    return path.join(process.cwd(), ...paths);
}

export async function ensureAppStateDirs() {
    const paths = APP_STATE_DIR_NAMES.map((dirName) => getAppDir(dirName));

    await Promise.all(paths.map((fullPath) => fs.promises.mkdir(fullPath).catch(console.error)));
}

function parseJson<T>(jsonData: string): T {
    return JSON.parse(jsonData) as T;
}

export async function loadJsonResource<T = unknown>(filePath: string): Promise<T> {
    const fullPath = getAppDir('resources', filePath);

    const contents = await fs.promises.readFile(fullPath, {
        encoding: 'utf-8',
    });

    return parseJson<T>(contents);
}

export function loadJsonResourceSync<T = unknown>(filePath: string): T {
    const fullPath = getAppDir('resources', filePath);

    const contents = fs.readFileSync(fullPath, {
        encoding: 'utf-8',
    });

    return parseJson<T>(contents);
}
