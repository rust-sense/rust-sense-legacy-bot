declare module 'node:sqlite' {
    export class DatabaseSync {
        constructor(path: string);
        close(): void;
        exec(sql: string): void;
        prepare(sql: string): StatementSync;
    }

    export class StatementSync {
        get(...params: unknown[]): unknown | undefined;
        all(...params: unknown[]): unknown[];
        run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    }
}
