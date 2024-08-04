import * as instanceService from './instance';
import * as credentialsService from './credentials';
import { cwdPath } from './resourceManager';
import fs from 'node:fs/promises';

export async function migrate() {
    await migrateInstances();
    await migrateCredentials();
}

async function migrateInstances() {
    const instancesDirPath = cwdPath('instances');

    if (!fs.access(instancesDirPath)) {
        return false;
    }

    const instanceFiles = await fs.readdir(instancesDirPath);
    for (const instanceFile of instanceFiles) {
        console.log(instanceFile);
        const instance = await fs.readFile(cwdPath('instances', instanceFile), 'utf-8');
        console.log(instance);
        //await instanceService.save(instanceFile.replace('.json', ''), JSON.parse(instance));
    }
    //await fs.unlink(instancesDirPath);
}

async function migrateCredentials() {}
