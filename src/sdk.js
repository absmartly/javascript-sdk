import { Client } from "@absmartly/javascript-client";
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

	createContext(params, options) {
		const transformed = Object.assign(
			{},
			{
				units: Object.keys(params.units).map((type) => ({
					type,
					uid: params.units[type],
				})),
			}
		);

		for (const unit of transformed.units) {
			const type = typeof unit.uid;
			if (type !== "string") {
				if (type === "number") {
					unit.uid = (unit.uid | 0).toString();
				} else {
					throw new Error(
						`Unit '${unit.type}' UID is of unsupported type '${type}'. UID must be one of ['string', 'number']`
					);
				}
			}
		}

		options = this._contextOptions(options);
		const data = this._client.createContext(transformed);
		return new Context(this, this._client, options, data);
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

	createContextWith(data, options) {
		options = this._contextOptions(options);
		return new Context(this, this._client, options, data);
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
}
