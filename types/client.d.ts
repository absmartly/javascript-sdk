import { ClientOptions } from "./types";
export default class Client {
    private readonly _opts;
    private readonly _delay;
    constructor(opts: ClientOptions);
    getContext(options?: Record<string, unknown>): any;
    createContext(params: Record<string, unknown>, options: Record<string, unknown>): any;
    publish(params: Record<string, unknown>, options?: Record<string, unknown>): any;
    request(options: Record<string, any>): any;
    post(options: Record<string, unknown>): any;
    put(options: Record<string, unknown>): any;
    getUnauthed(options: Record<string, unknown>): any;
}
