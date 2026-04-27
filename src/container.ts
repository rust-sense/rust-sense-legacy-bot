import { createContainer, asClass, asValue } from 'awilix';
import type { AwilixContainer } from 'awilix';

export const container: AwilixContainer = createContainer({
    injectionMode: 'PROXY',
});

export function registerSingleton<T>(name: string, instance: T): void {
    container.register({
        [name]: asValue(instance),
    });
}

export function registerClass<T>(name: string, Class: new (...args: any[]) => T): void {
    container.register({
        [name]: asClass(Class).singleton(),
    });
}

export function resolve<T>(name: string): T {
    return container.resolve<T>(name);
}
