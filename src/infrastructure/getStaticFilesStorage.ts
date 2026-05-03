import RustlabsStaticStorage from './RustlabsStaticStorage.js';

let staticFilesStorage: RustlabsStaticStorage | null = null;

export default function getStaticFilesStorage(): RustlabsStaticStorage {
    if (staticFilesStorage === null) {
        staticFilesStorage = new RustlabsStaticStorage();
    }

    return staticFilesStorage;
}
