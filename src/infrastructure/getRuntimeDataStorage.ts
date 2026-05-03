import RuntimeDataStorage from './RuntimeDataStorage.js';

let runtimeDataStorage: RuntimeDataStorage | null = null;

export default function getRuntimeDataStorage(): RuntimeDataStorage {
    if (runtimeDataStorage === null) {
        runtimeDataStorage = new RuntimeDataStorage();
    }

    return runtimeDataStorage;
}
