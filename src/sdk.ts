import Client from "./client";
import Context from "./context";
import { ContextPublisher } from "./publisher";
import { ContextDataProvider } from "./provider";
import { isBrowser } from "./utils";
import { ClientRequestOptions, ContextData, ContextOptions, EventLogger, SDKOptions, ContextParams } from "./types";

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

	constructor(options: SDKOptions) {
		const clientOptions = Object.assign(
			{
				agent: "absmartly-javascript-sdk",
			},
			...Object.entries(options || {})
				.filter(
					(x) =>
						["application", "agent", "apiKey", "endpoint", "keepalive", "environment", "retries", "timeout"].indexOf(
							x[0]
						) !== -1
				)
				.map((x) => ({ [x[0]]: x[1] }))
		);

		options = Object.assign({}, options);

		this._client = options.client || new Client(clientOptions);
		this._eventLogger = options.eventLogger || SDK.defaultEventLogger;
		this._publisher = options.publisher || new ContextPublisher();
		this._provider = options.provider || new ContextDataProvider();
	}

	getContextData(requestOptions: ClientRequestOptions) {
		return this._provider.getContextData(this, requestOptions);
	}

	createContext(params: ContextParams, options: ContextOptions, requestOptions: ClientRequestOptions) {
		SDK._validateParams(params);

		options = SDK._contextOptions(options);
		const data = this._provider.getContextData(this, requestOptions);
		return new Context(this, options, params, data);
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

	createContextWith(params: ContextParams, data: Promise<ContextData>, options: ContextOptions) {
		SDK._validateParams(params);

		options = SDK._contextOptions(options);
		return new Context(this, options, params, data);
	}

	static _contextOptions(options: ContextOptions): ContextOptions {
		return Object.assign(
			{
				publishDelay: isBrowser() ? 100 : -1,
				refreshPeriod: 0,
			},
			options || {}
		);
	}

	static _validateParams(params: ContextParams) {
		Object.entries(params.units).forEach((entry) => {
			const type = typeof entry[1];
			if (type !== "string" && type !== "number") {
				throw new Error(
					`Unit '${entry[0]}' UID is of unsupported type '${type}'. UID must be one of ['string', 'number']`
				);
			}

			if (typeof entry[1] === "string") {
				if (entry[1].length === 0) {
					throw new Error(`Unit '${entry[0]}' UID length must be >= 1`);
				}
			}
		});
	}
}
