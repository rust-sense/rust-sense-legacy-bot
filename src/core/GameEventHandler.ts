export default abstract class GameEventHandler {
    constructor(public eventName: string) {}

    abstract execute(): Promise<void>;
}
