import { Client } from "./client";
import { Context } from "./context";
import { ContextPublisher } from "./publisher";
import { ContextDataProvider } from "./provider";
import type {
	ClientOptions,
	ClientRequestOptions,
	ContextData,
	ContextParams,
	EventLogger,
	EventLoggerData,
} from "./types";

type ContextOptionsInput = {
	publisher?: ContextPublisher;
	dataProvider?: ContextDataProvider;
	eventLogger?: EventLogger;
	refreshPeriod?: number;
	publishDelay?: number;
	includeSystemAttributes?: boolean;
};

type ContextOptionsFull = Required<Pick<ContextOptionsInput, "refreshPeriod" | "publishDelay">> &
	Omit<ContextOptionsInput, "refreshPeriod" | "publishDelay">;

export type SDKOptions = {
	client?: Client;
	eventLogger?: EventLogger;
	publisher?: ContextPublisher;
	provider?: ContextDataProvider;
};

function isLongLivedApp(): boolean {
	return (
		(typeof window !== "undefined" && typeof window.document !== "undefined") ||
		(typeof navigator !== "undefined" && navigator.product === "ReactNative")
	);
}

const CLIENT_OPTION_KEYS = [
	"application",
	"agent",
	"apiKey",
	"endpoint",
	"keepalive",
	"environment",
	"retries",
	"timeout",
];

export class SDK {
	static defaultEventLogger: EventLogger = (_: unknown, eventName: string, data?: EventLoggerData) => {
		if (eventName === "error") console.error(data);
	};

	private _eventLogger: EventLogger;
	private _publisher: ContextPublisher;
	private _provider: ContextDataProvider;
	private readonly _client: Client;

	constructor(options: ClientOptions & SDKOptions) {
		const clientOptions = Object.assign(
			{ agent: "absmartly-javascript-sdk" },
			...Object.entries(options || {})
				.filter((x) => CLIENT_OPTION_KEYS.indexOf(x[0]) !== -1)
				.map((x) => ({ [x[0]]: x[1] })),
		) as ClientOptions;

		this._client = options.client || new Client(clientOptions);
		this._eventLogger = options.eventLogger || SDK.defaultEventLogger;
		this._publisher = options.publisher || new ContextPublisher();
		this._provider = options.provider || new ContextDataProvider();
	}

	getContextData(requestOptions: ClientRequestOptions): Promise<ContextData> {
		return this._provider.getContextData(this, requestOptions);
	}

	createContext(
		params: ContextParams,
		options?: Partial<ContextOptionsInput>,
		requestOptions?: Partial<ClientRequestOptions>,
	): Context {
		SDK._validateParams(params);
		const fullOptions = SDK._contextOptions(options);
		const data = this._provider.getContextData(this, requestOptions);
		return new Context(this, fullOptions, params, data);
	}

	createContextWith(
		params: ContextParams,
		data: ContextData | Promise<ContextData>,
		options?: Partial<ContextOptionsInput>,
	): Context {
		SDK._validateParams(params);
		const fullOptions = SDK._contextOptions(options);
		return new Context(this, fullOptions, params, data);
	}

	setEventLogger(logger: EventLogger): void {
		this._eventLogger = logger;
	}

	getEventLogger(): EventLogger {
		return this._eventLogger;
	}

	setContextPublisher(publisher: ContextPublisher): void {
		this._publisher = publisher;
	}

	getContextPublisher(): ContextPublisher {
		return this._publisher;
	}

	setContextDataProvider(provider: ContextDataProvider): void {
		this._provider = provider;
	}

	getContextDataProvider(): ContextDataProvider {
		return this._provider;
	}

	getClient(): Client {
		return this._client;
	}

	private static _contextOptions(options?: Partial<ContextOptionsInput>): ContextOptionsFull {
		return Object.assign(
			{ publishDelay: isLongLivedApp() ? 100 : -1, refreshPeriod: 0 },
			options || {},
		) as ContextOptionsFull;
	}

	private static _validateParams(params: ContextParams): void {
		for (const [key, value] of Object.entries(params.units)) {
			const type = typeof value;
			if (type !== "string" && type !== "number") {
				throw new Error(
					`Unit '${key}' UID is of unsupported type '${type}'. UID must be one of ['string', 'number']`,
				);
			}
			if (typeof value === "string" && value.length === 0) {
				throw new Error(`Unit '${key}' UID length must be >= 1`);
			}
		}
	}
}
