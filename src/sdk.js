import Client from "./client";
import Context from "./context";

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

		options = Object.assign(
			{},
			{
				eventLogger: SDK.defaultEventLogger,
			},
			options
		);

		this._eventLogger = options.eventLogger;
		this._client = new Client(clientOptions);
	}

	getContextData() {
		return this._client.getContext();
	}

	createContext(params, options) {
		SDK._validateParams(params);

		options = this._contextOptions(options);
		const data = this._client.getContext();
		return new Context(this, this._client, options, params, data);
	}

	setEventLogger(logger) {
		this._eventLogger = logger;
	}

	getEventLogger() {
		return this._eventLogger;
	}

	getClient() {
		return this._client;
	}

	createContextWith(params, data, options) {
		SDK._validateParams(params);

		options = this._contextOptions(options);
		return new Context(this, this._client, options, params, data);
	}

	_contextOptions(options) {
		const isBrowser = typeof window !== "undefined" && typeof window.navigator !== "undefined";
		return Object.assign(
			{
				publishDelay: isBrowser ? 100 : -1,
				refreshPeriod: 0,
				eventLogger: this.getEventLogger(),
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
