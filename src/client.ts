import fetch from "./fetch"; // eslint-disable-line no-shadow
// eslint-disable-next-line no-shadow
import { AbortController } from "./abort";
// eslint-disable-next-line no-shadow
import { AbortError, RetryError, TimeoutError } from "./errors";

import { getApplicationName, getApplicationVersion } from "./utils";
import { AbortSignal as ABsmartlyAbortSignal } from "./abort-controller-shim";
import { ContextOptions, ContextParams } from "./context";
import { PublishParams } from "./publisher";

export type FetchResponse = {
	status: number;
	ok: boolean;
	text: () => Promise<string>;
	statusText: string;
	json: () => Promise<string>;
};

export type ClientRequestOptions = {
	query?: Record<string, string | number | boolean>;
	path: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
	body?: Record<string, unknown>;
	auth?: boolean;
	signal?: AbortSignal | ABsmartlyAbortSignal;
	timeout?: number;
};

export type ClientOptions = {
	agent?: "javascript-client";
	apiKey: string;
	application: string | { name: string; version: number };
	endpoint: string;
	environment: string;
	retries?: number;
	timeout?: number;
	keepalive?: boolean;
};

export default class Client {
	private readonly _opts: ClientOptions;
	private readonly _delay: number;

	constructor(opts: ClientOptions) {
		this._opts = Object.assign(
			{
				agent: "javascript-client",
				apiKey: undefined,
				application: undefined,
				endpoint: undefined,
				environment: undefined,
				retries: 5,
				timeout: 3000,
				keepalive: true,
			},
			opts
		);

		for (const key of ["agent", "application", "apiKey", "endpoint", "environment"] as const) {
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

	getContext(options?: Partial<ClientRequestOptions>) {
		return this.getUnauthed({
			...options,
			path: "/context",
			query: {
				application: getApplicationName(this._opts.application),
				environment: this._opts.environment,
			},
		});
	}

	createContext(params: ContextParams, options: ContextOptions) {
		const body = {
			units: params.units,
		};

		return this.post({
			...options,
			path: "/context",
			body,
		});
	}

	publish(params: PublishParams, options?: ClientRequestOptions) {
		const body: PublishParams = {
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

	request(options: ClientRequestOptions) {
		let url = `${this._opts.endpoint}${options.path}`;
		if (options.query) {
			const keys = Object.keys(options.query);
			if (keys.length > 0) {
				const encoded = keys
					.map((k) => (options.query ? `${k}=${encodeURIComponent(options.query[k])}` : null))
					.join("&");
				url = `${url}?${encoded}`;
			}
		}

		const controller = new AbortController();

		const tryOnce = () => {
			const opts: Record<string, unknown> = {
				method: options.method,
				body: options.body !== undefined ? JSON.stringify(options.body, null, 0) : undefined,
				signal: controller.signal,
				keepalive: this._opts.keepalive,
			};

			if (options.auth) {
				opts.headers = {
					"Content-Type": "application/json",
					"X-API-Key": this._opts.apiKey,
					"X-Agent": this._opts.agent,
					"X-Environment": this._opts.environment,
					"X-Application": getApplicationName(this._opts.application),
					"X-Application-Version": getApplicationVersion(this._opts.application),
				};
			}

			return fetch(url, opts).then((response: FetchResponse) => {
				if (!response.ok) {
					const bail = response.status >= 400 && response.status < 500;
					return response.text().then((text: string) => {
						const error: Error & { _bail?: boolean } = new Error(
							text !== null && text.length > 0 ? text : response.statusText
						);
						error._bail = bail;

						return Promise.reject(error);
					});
				}

				return response.json();
			});
		};

		type WaitFn = ((ms: number) => Promise<void>) & { reject?: (reason: AbortError) => void };
		type TryWithFn = ((
			retries: number,
			timeout: number,
			tries?: number,
			waited?: number
		) => ReturnType<typeof tryOnce>) & {
			timedout?: boolean;
		};

		const wait: WaitFn = (ms) =>
			new Promise((resolve, reject) => {
				const timeoutId = setTimeout(() => {
					delete wait.reject;
					resolve();
				}, ms);

				wait.reject = (reason) => {
					clearTimeout(timeoutId);
					reject(reason);
				};
			});

		const tryWith: TryWithFn = (retries, timeout, tries = 0, waited = 0) => {
			delete tryWith.timedout;

			return tryOnce().catch((reason: Error & { _bail?: boolean }) => {
				console.warn(reason);

				if (reason._bail || retries <= 0) {
					throw new Error(reason.message);
				} else if (tries >= retries) {
					throw new RetryError(tries, reason, url);
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
			timeout > 0
				? setTimeout(() => {
						tryWith.timedout = true;
						abort();
				  }, timeout)
				: 0;

		const finalCleanUp = () => {
			clearTimeout(timeoutId);
			if (options.signal) {
				options.signal.removeEventListener("abort", abort);
			}
		};

		return tryWith(this._opts.retries ?? 5, this._opts.timeout ?? 3000)
			.then((value: string) => {
				finalCleanUp();
				return value;
			})
			.catch((error: Error) => {
				finalCleanUp();
				throw error;
			});
	}

	post(options: ClientRequestOptions) {
		return this.request({
			...options,
			auth: true,
			method: "POST",
		});
	}

	put(options: ClientRequestOptions) {
		return this.request({
			...options,
			auth: true,
			method: "PUT",
		});
	}

	getUnauthed(options: ClientRequestOptions) {
		return this.request({
			...options,
			method: "GET",
		});
	}
}
