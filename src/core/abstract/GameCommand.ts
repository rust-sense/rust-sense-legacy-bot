export default abstract class DiscordEventHandler {
    constructor(public eventName: string) {}

    abstract execute(): Promise<void>;
}
