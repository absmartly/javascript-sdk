import Client from "./client";
import Context from "./context";
import { ContextPublisher } from "./publisher";
import { ContextDataProvider } from "./provider";
import { EventLogger } from "./types";
export default class SDK {
    static defaultEventLogger: EventLogger;
    private _eventLogger;
    private _publisher;
    private _provider;
    private readonly _client;
    constructor(options: Record<string, any>);
    getContextData(requestOptions: Record<string, unknown>): any;
    createContext(params: Record<string, unknown>, options: Record<string, unknown>, requestOptions: Record<string, unknown>): Context;
    setEventLogger(logger: EventLogger): void;
    getEventLogger(): EventLogger;
    setContextPublisher(publisher: ContextPublisher): void;
    getContextPublisher(): ContextPublisher;
    setContextDataProvider(provider: ContextDataProvider): void;
    getContextDataProvider(): ContextDataProvider;
    getClient(): Client;
    createContextWith(params: Record<string, unknown>, data: Record<string, unknown>, options: Record<string, unknown>): Context;
    static _contextOptions(options: Record<string, unknown>): {
        publishDelay: number;
        refreshPeriod: number;
    } & Record<string, unknown>;
    static _validateParams(params: Record<string, any>): void;
}
