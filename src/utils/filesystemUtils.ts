import fs from 'node:fs';
import path from 'node:path';

export const APP_STATE_DIR_NAMES = ['logs', 'instances', 'credentials', 'maps', 'authtokens', 'data'] as const;

export function cwdPath(...paths: string[]) {
    return path.join(process.cwd(), ...paths);
}

export async function ensureAppStateDirs() {
    const paths = APP_STATE_DIR_NAMES.map((dirName) => cwdPath(dirName));

    await Promise.all(paths.map((fullPath) => fs.promises.mkdir(fullPath, { recursive: true })));
}

function parseJson<T>(jsonData: string): T {
    return JSON.parse(jsonData) as T;
}

export async function loadJson<T = unknown>(filePath: string): Promise<T> {
    const contents = await fs.promises.readFile(filePath, {
        encoding: 'utf-8',
    });

    return parseJson<T>(contents);
}

export function loadJsonSync<T = unknown>(filePath: string): T {
    const contents = fs.readFileSync(filePath, {
        encoding: 'utf-8',
    });

    return parseJson<T>(contents);
}

export async function loadJsonResource<T = unknown>(filePath: string): Promise<T> {
    const fullPath = cwdPath('resources', filePath);
    return await loadJson<T>(fullPath);
}

export function loadJsonResourceSync<T = unknown>(filePath: string): T {
    const fullPath = cwdPath('resources', filePath);
    return loadJsonSync<T>(fullPath);
}

export async function writeJson(filePath: string, data: unknown) {
    const contents = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, contents, {
        encoding: 'utf-8',
    });
}

export function writeJsonSync(filePath: string, data: unknown) {
    const contents = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, contents, {
        encoding: 'utf-8',
    });
}
