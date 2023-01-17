export declare const getApplicationName: (app: string | {
    name: string;
    version: number;
}) => string;
export declare const getApplicationVersion: (app: string | {
    name: string;
    version: number;
}) => number;
export declare function isBrowser(): boolean;
export declare function isWorker(): boolean;
export declare function isNumeric(value: any): boolean;
export declare function isObject(value: any): boolean;
export declare function isPromise(value: any): boolean;
export declare function isEqualsDeep(a: any, b: any, astack?: any[], bstack?: any[]): boolean | undefined;
export declare function arrayEqualsShallow(a: any[], b: any[]): boolean;
export declare function stringToUint8Array(value: string): Uint8Array;
export declare function base64UrlNoPadding(value: Uint8Array): string;
export declare function hashUnit(value: string | number): string;
export declare function chooseVariant(split: number[], prob: number): number;
