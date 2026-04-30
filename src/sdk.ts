import Client, { type ClientOptions, type ClientRequestOptions } from "./client";
import Context, {
	type ContextData,
	type ContextOptions,
	type ContextParams,
	type Exposure,
	type Goal,
} from "./context";
import { ContextPublisher, type PublishParams } from "./publisher";
import { ContextDataProvider } from "./provider";
import { isLongLivedApp } from "./utils";

export type EventLoggerData = Error | Exposure | Goal | ContextData | PublishParams;

export type EventName = "error" | "ready" | "refresh" | "publish" | "exposure" | "goal" | "finalize";

export type EventLogger = (context: Context, eventName: EventName, data?: EventLoggerData) => void;

export type SDKOptions = {
	client?: Client;
	eventLogger?: EventLogger;
	publisher?: ContextPublisher;
	provider?: ContextDataProvider;
};

export default class SDK {
	static defaultEventLogger: EventLogger = (_, eventName, data) => {
		if (eventName === "error") {
			console.error(data);
		}
	};
	private _eventLogger: EventLogger;
	private _publisher: ContextPublisher;
	private _provider: ContextDataProvider;
	private readonly _client: Client;

	constructor(options: ClientOptions & SDKOptions) {
		const clientOptions = SDK._extractClientOptions(options);
		options = Object.assign({}, options);

		this._client = options.client || new Client(clientOptions);
		this._eventLogger = options.eventLogger || SDK.defaultEventLogger;
		this._publisher = options.publisher || new ContextPublisher();
		this._provider = options.provider || new ContextDataProvider();
	}

	private static _extractClientOptions(options: ClientOptions & SDKOptions): ClientOptions {
		const clientOptionKeys = [
			"application",
			"agent",
			"apiKey",
			"endpoint",
			"keepalive",
			"environment",
			"retries",
			"timeout",
		];
		const extracted: Partial<ClientOptions> = {
			agent: "absmartly-javascript-sdk",
		};

		for (const [key, value] of Object.entries(options || {})) {
			if (clientOptionKeys.includes(key)) {
				(extracted as Record<string, unknown>)[key] = value;
			}
		}

		return extracted as ClientOptions;
	}

	getContextData(requestOptions: ClientRequestOptions) {
		return this._provider.getContextData(this, requestOptions);
	}

	createContext(
		params: ContextParams,
		options?: Partial<ContextOptions>,
		requestOptions?: Partial<ClientRequestOptions>
	) {
		SDK._validateParams(params);

		const fullOptions = SDK._contextOptions(options);
		const data = this._provider.getContextData(this, requestOptions);
		return new Context(this, fullOptions, params, data);
	}

	setEventLogger(logger: EventLogger) {
		this._eventLogger = logger;
	}

	getEventLogger() {
		return this._eventLogger;
	}

	setContextPublisher(publisher: ContextPublisher) {
		this._publisher = publisher;
	}

	getContextPublisher() {
		return this._publisher;
	}

	setContextDataProvider(provider: ContextDataProvider) {
		this._provider = provider;
	}

	getContextDataProvider() {
		return this._provider;
	}

	getClient() {
		return this._client;
	}

	createContextWith(
		params: ContextParams,
		data: ContextData | Promise<ContextData>,
		options?: Partial<ContextOptions>
	) {
		SDK._validateParams(params);

		const fullOptions = SDK._contextOptions(options);

		return new Context(this, fullOptions, params, data);
	}

	private static _contextOptions(options?: Partial<ContextOptions>): ContextOptions {
		const DEFAULT_PUBLISH_DELAY_MS = 100;
		const NO_PUBLISH_DELAY = -1;
		const NO_REFRESH = 0;

		return {
			publishDelay: isLongLivedApp() ? DEFAULT_PUBLISH_DELAY_MS : NO_PUBLISH_DELAY,
			refreshPeriod: NO_REFRESH,
			...options,
		};
	}

	private static _validateParams(params: ContextParams) {
		for (const [unitType, uid] of Object.entries(params.units)) {
			const type = typeof uid;
			if (type !== "string" && type !== "number") {
				throw new Error(
					`Unit '${unitType}' UID is of unsupported type '${type}'. UID must be one of ['string', 'number']`
				);
			}

			if (typeof uid === "string") {
				if (uid.length === 0) {
					throw new Error(`Unit '${unitType}' UID length must be >= 1`);
				}
			}
		}
	}
}
