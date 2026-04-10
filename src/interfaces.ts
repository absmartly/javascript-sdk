import type {
	ApplicationObject,
	ContextData,
	Exposure,
	GoalAchievement,
	PublishParams,
} from "./models";

export type EventName = "error" | "ready" | "refresh" | "publish" | "exposure" | "goal" | "finalize";

export type EventLoggerData = Error | Exposure | GoalAchievement | ContextData | PublishParams;

export type EventLogger = (context: unknown, eventName: EventName, data?: EventLoggerData) => void;

export type ContextParams = {
	units: Record<string, string | number>;
};

export type ContextOptions = {
	publishDelay: number;
	refreshPeriod: number;
	includeSystemAttributes?: boolean;
};

export interface ClientRequestOptions {
	query?: Record<string, string | number | boolean>;
	path: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
	body?: Record<string, unknown>;
	auth?: boolean;
	signal?: AbortSignal;
	timeout?: number;
}

export type ClientOptions = {
	agent?: string;
	apiKey: string;
	application: string | ApplicationObject;
	endpoint: string;
	environment: string;
	retries?: number;
	timeout?: number;
	keepalive?: boolean;
	fetchImpl?: typeof fetch;
	AbortControllerImpl?: typeof AbortController;
};

export type SDKOptions = {
	client?: Client;
	eventLogger?: EventLogger;
	publisher?: ContextPublisher;
	provider?: ContextDataProvider;
};

export interface Client {
	getContext(options?: Partial<ClientRequestOptions>): Promise<ContextData>;
	publish(params: PublishParams, options?: ClientRequestOptions): Promise<unknown>;
	getAgent(): string;
	getApplication(): ApplicationObject;
	getEnvironment(): string;
}

export interface ContextDataProvider {
	getContextData(sdk: unknown, requestOptions?: Partial<ClientRequestOptions>): Promise<ContextData>;
}

export interface ContextPublisher {
	publish(
		request: PublishParams,
		sdk: unknown,
		context: unknown,
		requestOptions?: ClientRequestOptions,
	): Promise<unknown>;
}
