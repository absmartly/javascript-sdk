export declare class TimeoutError extends Error {
    readonly timeout: number;
    constructor(timeout: number);
}
export declare class RetryError extends Error {
    readonly retries: number;
    constructor(retries: number);
}
export declare class AbortError extends Error {
    constructor(message?: string);
}
