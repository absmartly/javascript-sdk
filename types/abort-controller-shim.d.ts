export declare class AbortSignal {
    aborted: boolean;
    private readonly _events;
    constructor();
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
    dispatchEvent(evt: {
        type: string;
    }): void;
    toString(): string;
}
export declare class AbortController {
    signal: AbortSignal;
    abort(): void;
    toString(): string;
}
export default AbortController;
