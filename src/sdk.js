import Client from "./client";
import Context from "./context";
import { ContextPublisher } from "./publisher";
import { ContextDataProvider } from "./provider";

export default class SDK {
	static defaultEventLogger = (context, eventName, data) => {
		if (eventName === "error") {
			console.error(data);
		}
	};

	constructor(options) {
		const clientOptions = Object.assign(
			{
				agent: "absmartly-javascript-sdk",
			},
			...Object.entries(options || {})
				.filter(
					(x) => ["application", "agent", "apiKey", "endpoint", "environment", "timeout"].indexOf(x[0]) !== -1
				)
				.map((x) => ({ [x[0]]: x[1] }))
		);

		options = Object.assign({}, options);

		this._client = options.client || new Client(clientOptions);
		this._eventLogger = options.eventLogger || SDK.defaultEventLogger;
		this._publisher = options.publisher || new ContextPublisher();
		this._provider = options.provider || new ContextDataProvider();
	}

	getContextData() {
		return this._provider.getContextData(this);
	}

	createContext(params, options) {
		SDK._validateParams(params);

		options = SDK._contextOptions(options);
		const data = this._provider.getContextData(this);
		return new Context(this, options, params, data);
	}

	setEventLogger(logger) {
		this._eventLogger = logger;
	}

	getEventLogger() {
		return this._eventLogger;
	}

	setContextPublisher(publisher) {
		this._publisher = publisher;
	}

	getContextPublisher() {
		return this._publisher;
	}

	setContextDataProvider(provider) {
		this._provider = provider;
	}

	getContextDataProvider() {
		return this._provider;
	}

	getClient() {
		return this._client;
	}

	createContextWith(params, data, options) {
		SDK._validateParams(params);

		options = SDK._contextOptions(options);
		return new Context(this, options, params, data);
	}

	static _contextOptions(options) {
		const isBrowser = typeof window !== "undefined" && typeof window.navigator !== "undefined";
		return Object.assign(
			{
				publishDelay: isBrowser ? 100 : -1,
				refreshPeriod: 0,
			},
			options || {}
		);
	}

	static _validateParams(params) {
		for (const entry of Object.entries(params.units)) {
			const type = typeof entry[1];
			if (type !== "string" && type !== "number") {
				throw new Error(
					`Unit '${entry[0]}' UID is of unsupported type '${type}'. UID must be one of ['string', 'number']`
				);
			}
		}
	}
}
