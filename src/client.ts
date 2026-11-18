import fetch from "./fetch"; // eslint-disable-line no-shadow
// eslint-disable-next-line no-shadow
import { AbortController } from "./abort";
// eslint-disable-next-line no-shadow
import { AbortError, RetryError, TimeoutError } from "./errors";

import { AbortSignal as ABsmartlyAbortSignal } from "./abort-controller-shim";
import { ContextOptions, ContextParams } from "./context";
import { PublishParams } from "./publisher";
import { toWellFormedString } from "./utils";

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
	// Sends the SDK auth/metadata headers. post(), put() and get() set it; request() sends none unless true.
	auth?: boolean;
	signal?: AbortSignal | ABsmartlyAbortSignal;
	timeout?: number;
};

export type ApplicationObject = { name: string; version: number | string };

const DEFAULT_RETRIES = 5;
const DEFAULT_TIMEOUT_MS = 3000;
const RETRY_DELAY_MS = 50;

export type ClientOptions = {
	agent?: string;
	apiKey: string;
	application: string | ApplicationObject;
	endpoint: string;
	environment: string;
	retries?: number;
	timeout?: number;
	keepalive?: boolean;
};

// The collector reads X-Application-Version as a 64-bit integer and rejects anything else with a 400,
// so only a whole number of 1 to 18 digits is sent as-is; anything else (e.g. "1.2.3") is sent as 0.
function applicationVersionHeader(version: number | string): number | string {
	if (typeof version === "number") {
		return /^[0-9]{1,18}$/.test(String(version)) ? version : 0;
	}
	const trimmed = typeof version === "string" ? version.trim() : "";
	return /^[0-9]{1,18}$/.test(trimmed) ? trimmed : 0;
}

type NormalizedClientOptions = Omit<Required<ClientOptions>, "application"> & {
	application: ApplicationObject;
};

export default class Client {
	private readonly _opts: NormalizedClientOptions;
	private readonly _delay: number;

	constructor(opts: ClientOptions) {
		const merged: Record<string, unknown> = Object.assign(
			{
				agent: "javascript-client",
				retries: DEFAULT_RETRIES,
				timeout: DEFAULT_TIMEOUT_MS,
				keepalive: true,
			},
			opts
		);

		for (const key of ["agent", "application", "apiKey", "endpoint", "environment"]) {
			if (key in merged && merged[key] !== undefined) {
				const value = merged[key];
				if (typeof value !== "string" || (value as string).length === 0) {
					if (key === "application") {
						if (value !== null && typeof value === "object" && "name" in (value as object)) {
							continue;
						}
					}
					throw new Error(`Invalid '${key}' in options argument`);
				}
			} else {
				throw new Error(`Missing '${key}' in options argument`);
			}
		}

		if (typeof merged.application === "string") {
			merged.application = {
				name: merged.application,
				version: 0,
			};
		}

		this._opts = merged as unknown as NormalizedClientOptions;
		this._delay = RETRY_DELAY_MS;
	}

	getEnvironment(): string {
		return this._opts.environment;
	}

	getContext(options?: Partial<ClientRequestOptions>) {
		// Routed through getUnauthed() as in 1.13.4, so a subclass overriding it is still called.
		return this.getUnauthed({
			...options,
			auth: options?.auth !== false,
			path: "/context",
			query: {
				application: this._opts.application.name,
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
			// Built manually (not with URLSearchParams) because the declared IE 10
			// browser target excludes the `web.*` core-js polyfills that would
			// otherwise provide it (see babel.config.js). Values are normalized to
			// well-formed UTF-16 first: unlike `URLSearchParams`, `encodeURIComponent`
			// throws `URIError: URI malformed` on an unpaired surrogate.
			const queryString = Object.entries(options.query)
				.map(
					([key, value]) =>
						`${encodeURIComponent(toWellFormedString(key))}=${encodeURIComponent(toWellFormedString(String(value)))}`
				)
				.join("&");
			if (queryString) {
				url = `${url}?${queryString}`;
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
					"X-Application": this._opts.application.name,
					"X-Application-Version": applicationVersionHeader(this._opts.application.version),
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

		// `||`, as in 1.13.4: a request timeout of 0 falls back to the client timeout rather than disabling it.
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

		// The retry budget falls back to the default when the client timeout is null/undefined, as in 1.13.4.
		return tryWith(this._opts.retries ?? DEFAULT_RETRIES, options.timeout || (this._opts.timeout ?? DEFAULT_TIMEOUT_MS))
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

	getAgent(): string {
		return this._opts.agent;
	}

	getApplication(): ApplicationObject {
		return this._opts.application;
	}

	get(options: ClientRequestOptions) {
		return this.request({
			...options,
			auth: options.auth !== false,
			method: "GET",
		});
	}

	// Plain GET with 1.13 semantics: headers only when `auth: true` is passed. Use get() for SDK headers.
	getUnauthed(options: ClientRequestOptions) {
		return this.request({
			...options,
			method: "GET",
		});
	}
}
