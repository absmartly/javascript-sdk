import fetch from "./fetch"; // eslint-disable-line no-shadow
// eslint-disable-next-line no-shadow
import { AbortController } from "./abort";
import { AbortError, RetryError, TimeoutError } from "./errors";
import { AbortSignal } from "./abort-controller-shim";

interface IApplication {
	name: string;
	version: number | string;
}

interface Params {
	units?: {
		session_id: string;
	};
	hashed?: boolean | string;
	publishedAt?: string | number;
	goals?: any[];
	exposures?: any[];
	attributes?: any[];
}

interface IOptions {
	agent: string;
	apiKey: string | undefined;
	application: IApplication | undefined;
	environment: string | undefined;
	retries: number;
	timeout: number;
	endpoint: string;
}

interface IContextOptions {
	method: string;
	body: string;
	signal: AbortSignal | globalThis.AbortSignal;
	headers?: {
		"Content-Type": string;
		"X-API-Key": string;
		"X-Agent": string;
		"X-Application": string;
		"X-Environment": string;
		"X-Application-Version": number | string;
	};
}

type ErrorType = Error & { _bail?: boolean };

export default class Client {
	_opts: IOptions;
	_delay: number;
	constructor(opts?: IOptions) {
		this._opts = Object.assign(
			{
				agent: "javascript-client",
				apiKey: undefined,
				application: undefined,
				endpoint: undefined,
				environment: undefined,
				retries: 5,
				timeout: 3000,
			},
			opts
		);

		for (const key of ["agent", "application", "apiKey", "endpoint", "environment"]) {
			if (key in this._opts && this._opts[key] !== undefined) {
				const value = this._opts[key];
				if (typeof value !== "string" || value.length === 0) {
					if (key === "application") {
						if (value !== null && typeof value === "object" && "name" in value) {
							continue;
						}
					}
					throw new Error(`Invalid '${key}' in options argument`);
				}
			} else {
				throw new Error(`Missing '${key}' in options argument`);
			}
		}

		if (typeof this._opts.application === "string") {
			this._opts.application = {
				name: this._opts.application,
				version: 0,
			};
		}

		this._delay = 50;
	}

	getContext(options?: any) {
		return this.getUnauthed({
			...options,
			path: "/context",
			query: {
				application: this._opts.application.name,
				environment: this._opts.environment,
			},
		});
	}

	createContext(params: Params, options?: any) {
		const body = {
			units: params.units,
		};

		return this.post({
			...options,
			path: "/context",
			body,
		});
	}

	publish(params: Params, options?: any) {
		const body: Params = {
			units: params.units,
			hashed: params.hashed,
			publishedAt: params.publishedAt || Date.now(),
		};

		if (Array.isArray(params.goals) && params.goals.length > 0) {
			body.goals = params.goals;
		}

		if (Array.isArray(params.exposures) && params.exposures.length > 0) {
			body.exposures = params.exposures;
		}

		if (Array.isArray(params.attributes) && params.attributes.length > 0) {
			body.attributes = params.attributes;
		}

		return this.put({
			...options,
			path: "/context",
			body,
		});
	}

	request(options) {
		let url = `${this._opts.endpoint}${options.path}`;
		if (options.query) {
			const keys = Object.keys(options.query);
			if (keys.length > 0) {
				const encoded = keys.map((k) => `${k}=${encodeURIComponent(options.query[k])}`).join("&");
				url = `${url}?${encoded}`;
			}
		}

		const controller = new AbortController();

		const tryOnce = () => {
			const opts: IContextOptions = {
				method: options.method,
				body: options.body !== undefined ? JSON.stringify(options.body, null, 0) : undefined,
				signal: controller.signal,
			};

			if (options.auth) {
				opts.headers = {
					"Content-Type": "application/json",
					"X-API-Key": this._opts.apiKey,
					"X-Agent": this._opts.agent,
					"X-Environment": this._opts.environment,
					"X-Application": this._opts.application.name,
					"X-Application-Version": this._opts.application.version || 0,
				};
			}

			return fetch(url, opts).then((response) => {
				if (!response.ok) {
					const bail = response.status >= 400 && response.status < 500;
					return response.text().then((text) => {
						let error: ErrorType = new Error(text !== null && text.length > 0 ? text : response.statusText);
						error._bail = bail;

						return Promise.reject(error);
					});
				}

				return response.json();
			});
		};

		const wait: any = (ms: number) =>
			new Promise<void>((resolve, reject) => {
				const timeoutId = setTimeout(() => {
					delete wait.reject;
					resolve();
				}, ms);

				wait.reject = (reason: string) => {
					clearTimeout(timeoutId);
					reject(reason);
				};
			});

		const tryWith: any = (retries: number, timeout: number, tries: number = 0, waited: number = 0) => {
			delete tryWith.timedout;

			return tryOnce().catch((reason) => {
				console.warn(reason);

				if (reason._bail || retries <= 0) {
					throw new Error(reason.message);
				} else if (tries >= retries) {
					throw new RetryError(tries);
				} else if (waited >= timeout || reason.name === "AbortError") {
					if (tryWith.timedout) {
						throw new TimeoutError(timeout);
					}

					throw reason;
				}

				let delay = (1 << tries) * this._delay + 0.5 * Math.random() * this._delay;
				if (waited + delay > timeout) {
					delay = timeout - waited;
				}

				return wait(delay).then(() => tryWith(retries, timeout, tries + 1, waited + delay));
			});
		};

		const abort = () => {
			if (wait.reject) {
				wait.reject(new AbortError());
			} else {
				controller.abort();
			}
		};

		if (options.signal) {
			options.signal.addEventListener("abort", abort);
		}

		const timeout = options.timeout || this._opts.timeout || 0;
		const timeoutId =
			timeout > 0 &&
			setTimeout(() => {
				tryWith.timedout = true;
				abort();
			}, timeout);
		return tryWith(this._opts.retries, this._opts.timeout).finally(() => {
			clearTimeout(timeoutId);
			if (options.signal) {
				options.signal.removeEventListener("abort", abort);
			}
		});
	}

	post(options) {
		return this.request({
			...options,
			auth: true,
			method: "POST",
		});
	}

	put(options) {
		return this.request({
			...options,
			auth: true,
			method: "PUT",
		});
	}

	getUnauthed(options) {
		return this.request({
			...options,
			method: "GET",
		});
	}
}
