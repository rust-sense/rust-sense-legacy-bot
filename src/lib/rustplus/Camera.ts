import { EventEmitter } from 'events';
import { Jimp, rgbaToInt } from 'jimp';
import type { RustPlus } from './RustPlus.js';

export class Camera extends EventEmitter {
    static Buttons = {
        NONE: 0,
        FORWARD: 2,
        BACKWARD: 4,
        LEFT: 8,
        RIGHT: 16,
        JUMP: 32,
        DUCK: 64,
        SPRINT: 128,
        USE: 256,
        FIRE_PRIMARY: 1024,
        FIRE_SECONDARY: 2048,
        RELOAD: 8192,
        FIRE_THIRD: 134217728,
    };

    static ControlFlags = {
        NONE: 0,
        MOVEMENT: 1,
        MOUSE: 2,
        SPRINT_AND_DUCK: 4,
        FIRE: 8,
        RELOAD: 16,
        CROSSHAIR: 32,
    };

    rustplus: RustPlus;
    identifier: string;
    isSubscribed: boolean;
    cameraRays: any[];
    cameraSubscribeInfo: any;
    subscribeInterval: ReturnType<typeof setInterval> | null;

    constructor(rustplus: RustPlus, identifier: string) {
        super();
        this.rustplus = rustplus;
        this.identifier = identifier;
        this.isSubscribed = false;
        this.cameraRays = [];
        this.cameraSubscribeInfo = null;
        this.subscribeInterval = null;

        this.rustplus.on('message', async (message: any) => {
            await this._onMessage(message);
        });

        this.rustplus.on('disconnected', async () => {
            if (this.isSubscribed) {
                await this.unsubscribe();
            }
        });
    }

    private async _onMessage(message: any): Promise<void> {
        if (!this.isSubscribed) return;
        if (message.broadcast && message.broadcast.cameraRays) {
            await this._onCameraRays(message.broadcast.cameraRays);
        }
    }

    private async _onCameraRays(cameraRays: any): Promise<void> {
        if (!this.isSubscribed) return;

        this.cameraRays.push(cameraRays);

        if (this.cameraRays.length > 10) {
            this.cameraRays.shift();
            const frame = await this._renderCameraFrame(
                this.cameraRays,
                this.cameraSubscribeInfo.width,
                this.cameraSubscribeInfo.height,
            );
            await this._onRender(frame);
        }
    }

    private async _onRender(image: Buffer): Promise<void> {
        if (!this.isSubscribed) return;
        this.emit('render', image);
    }

    private async _renderCameraFrame(frames: any[], width: number, height: number): Promise<Buffer> {
        const samplePositionBuffer = new Int16Array(width * height * 2);
        for (let w = 0, _ = 0; _ < height; _++) {
            for (let g = 0; g < width; g++) {
                samplePositionBuffer[w] = g;
                samplePositionBuffer[++w] = _;
                w++;
            }
        }

        for (let B = new IndexGenerator(1337), R = width * height - 1; R >= 1; R--) {
            const C = 2 * R;
            const I = 2 * B.nextInt(R + 1);
            const P = samplePositionBuffer[C];
            const k = samplePositionBuffer[C + 1];
            const A = samplePositionBuffer[I];
            const F = samplePositionBuffer[I + 1];
            samplePositionBuffer[I] = P;
            samplePositionBuffer[I + 1] = k;
            samplePositionBuffer[C] = A;
            samplePositionBuffer[C + 1] = F;
        }

        const output = new Array(width * height);

        for (const frame of frames) {
            let sampleOffset = 2 * frame.sampleOffset;
            let dataPointer = 0;
            const rayLookback: number[][] = new Array(64);
            for (let r = 0; r < 64; r++) rayLookback[r] = [0, 0, 0];

            const rayData = frame.rayData;

            while (true) {
                if (dataPointer >= rayData.length - 1) break;

                let t: number, r: number, i: number;
                const n = rayData[dataPointer++];

                if (255 === n) {
                    const l = rayData[dataPointer++];
                    const o = rayData[dataPointer++];
                    const s = rayData[dataPointer++];
                    const u =
                        (3 * (((t = (l << 2) | (o >> 6)) / 128) | 0) + 5 * (((r = 63 & o) / 16) | 0) + 7 * (i = s)) &
                        63;
                    const f = rayLookback[u];
                    f[0] = t;
                    f[1] = r;
                    f[2] = i;
                } else {
                    const c = 192 & n;

                    if (0 === c) {
                        const h = 63 & n;
                        const y = rayLookback[h];
                        t = y[0];
                        r = y[1];
                        i = y[2];
                    } else if (64 === c) {
                        const p = 63 & n;
                        const v = rayLookback[p];
                        const b = v[0];
                        const w = v[1];
                        const _ = v[2];
                        const g = rayData[dataPointer++];
                        t = b + ((g >> 3) - 15);
                        r = w + ((7 & g) - 3);
                        i = _;
                    } else if (128 === c) {
                        const R = 63 & n;
                        const C = rayLookback[R];
                        const I = C[0];
                        const P = C[1];
                        const k = C[2];
                        t = I + (rayData[dataPointer++] - 127);
                        r = P;
                        i = k;
                    } else {
                        const A = rayData[dataPointer++];
                        const F = rayData[dataPointer++];
                        const D =
                            (3 * (((t = (A << 2) | (F >> 6)) / 128) | 0) +
                                5 * (((r = 63 & F) / 16) | 0) +
                                7 * (i = 63 & n)) &
                            63;
                        const E = rayLookback[D];
                        E[0] = t;
                        E[1] = r;
                        E[2] = i;
                    }
                }

                sampleOffset %= 2 * width * height;
                const index = samplePositionBuffer[sampleOffset++] + samplePositionBuffer[sampleOffset++] * width;
                output[index] = [t! / 1023, r! / 63, i!];
            }
        }

        const colours = [
            [0.5, 0.5, 0.5],
            [0.8, 0.7, 0.7],
            [0.3, 0.7, 1],
            [0.6, 0.6, 0.6],
            [0.7, 0.7, 0.7],
            [0.8, 0.6, 0.4],
            [1, 0.4, 0.4],
            [1, 0.1, 0.1],
        ];

        const image = new Jimp({ width, height });

        for (let i = 0; i < output.length; i++) {
            const ray = output[i];
            if (!ray) continue;

            const distance = ray[0];
            const alignment = ray[1];
            const material = ray[2];

            let target_colour: number[];

            if (distance === 1 && alignment === 0 && material === 0) {
                target_colour = [208, 230, 252];
            } else {
                const colour = colours[material];
                target_colour = [alignment * colour[0] * 255, alignment * colour[1] * 255, alignment * colour[2] * 255];
            }

            const x = i % width;
            const y = height - 1 - Math.floor(i / width);
            image.setPixelColor(rgbaToInt(target_colour[0], target_colour[1], target_colour[2], 255), x, y);
        }

        return image.getBuffer('image/png');
    }

    private async _subscribe(): Promise<void> {
        const response = await this.rustplus.sendRequestAsync({
            cameraSubscribe: { cameraId: this.identifier },
        });
        this.cameraSubscribeInfo = response.cameraSubscribeInfo;
        this.isSubscribed = true;
    }

    async subscribe(): Promise<void> {
        this.emit('subscribing');
        await this._subscribe();
        this.emit('subscribed');

        this.subscribeInterval = setInterval(async () => {
            if (this.isSubscribed) {
                await this._subscribe();
            }
        }, 10_000);
    }

    async unsubscribe(): Promise<void> {
        this.emit('unsubscribing');
        this.isSubscribed = false;
        clearInterval(this.subscribeInterval!);
        this.cameraRays = [];
        this.cameraSubscribeInfo = null;
        this.subscribeInterval = null;

        if (this.rustplus.isConnected()) {
            try {
                await this.rustplus.sendRequestAsync({ cameraUnsubscribe: {} });
            } catch {
                // ignore errors unsubscribing
            }
        }

        this.emit('unsubscribed');
    }

    async move(buttons: number, x: number, y: number): Promise<any> {
        return this.rustplus.sendRequestAsync({ cameraInput: { buttons, mouseDelta: { x, y } } });
    }

    async zoom(): Promise<void> {
        await this.move(Camera.Buttons.FIRE_PRIMARY, 0, 0);
        await this.move(Camera.Buttons.NONE, 0, 0);
    }

    async shoot(): Promise<void> {
        await this.move(Camera.Buttons.FIRE_PRIMARY, 0, 0);
        await this.move(Camera.Buttons.NONE, 0, 0);
    }

    async reload(): Promise<void> {
        await this.move(Camera.Buttons.RELOAD, 0, 0);
        await this.move(Camera.Buttons.NONE, 0, 0);
    }

    isAutoTurret(): boolean {
        const crosshairFlag = Camera.ControlFlags.CROSSHAIR;
        return (this.cameraSubscribeInfo?.controlFlags & crosshairFlag) === crosshairFlag;
    }
}

class IndexGenerator {
    private state: number;

    constructor(e: number) {
        this.state = 0 | e;
        this.nextState();
    }

    nextInt(e: number): number {
        let t = ((this.nextState() * (0 | e)) / 4294967295) | 0;
        if (t < 0) t = e + t - 1;
        return 0 | t;
    }

    private nextState(): number {
        let e = this.state;
        const t = e;
        e = ((e = ((e = (e ^ ((e << 13) | 0)) | 0) ^ ((e >>> 17) | 0)) | 0) ^ ((e << 5) | 0)) | 0;
        this.state = e;
        return t >= 0 ? t : 4294967295 + t - 1;
    }
}
