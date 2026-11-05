import { AbortError, RetryError, TimeoutError } from "./errors";
import type { ApplicationObject, ContextData, PublishParams } from "./models";
import type { ContextParams } from "./interfaces";
import { toWellFormedString } from "./utils";
import type { Client, ClientOptions, ClientRequestOptions } from "./interfaces";

const DEFAULT_RETRIES = 5;
const DEFAULT_TIMEOUT_MS = 3000;
const RETRY_DELAY_MS = 50;

type NormalizedClientOptions = Omit<Required<ClientOptions>, "application"> & {
	application: ApplicationObject;
};

export class DefaultClient implements Client {
	private readonly _opts: NormalizedClientOptions;
	private readonly _delay: number;
	private readonly _fetchImpl: typeof fetch;
	private readonly _AbortControllerImpl: typeof AbortController;

	constructor(opts: ClientOptions) {
		const merged: Record<string, unknown> = Object.assign(
			{ agent: "javascript-client", retries: DEFAULT_RETRIES, timeout: DEFAULT_TIMEOUT_MS, keepalive: true },
			opts
		);

		for (const key of ["agent", "application", "apiKey", "endpoint", "environment"]) {
			if (key in merged && merged[key] !== undefined) {
				const value = merged[key];
				if (typeof value !== "string" || (value as string).length === 0) {
					if (key === "application") {
						if (value !== null && typeof value === "object" && "name" in (value as object)) continue;
					}
					throw new Error(`Invalid '${key}' in options argument`);
				}
			} else {
				throw new Error(`Missing '${key}' in options argument`);
			}
		}

		if (typeof merged.application === "string") {
			merged.application = { name: merged.application, version: 0 };
		}

		this._opts = merged as unknown as NormalizedClientOptions;
		this._delay = RETRY_DELAY_MS;
		this._fetchImpl = (opts.fetchImpl ?? globalThis.fetch).bind(globalThis) as typeof fetch;
		this._AbortControllerImpl = opts.AbortControllerImpl ?? AbortController;
	}

	getContext(options?: Partial<ClientRequestOptions>): Promise<ContextData> {
		return this.get({
			...options,
			path: "/context",
			query: {
				application: this._opts.application.name,
				environment: this._opts.environment,
			},
		}) as Promise<ContextData>;
	}

	createContext(params: ContextParams): Promise<unknown> {
		return this.post({ path: "/context", body: { units: params.units } });
	}

	publish(params: PublishParams, options?: ClientRequestOptions): Promise<unknown> {
		const body: Record<string, unknown> = {
			units: params.units,
			hashed: params.hashed,
			publishedAt: params.publishedAt || Date.now(),
			sdkVersion: params.sdkVersion,
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

		return this.put({ ...options, path: "/context", body });
	}

	request(options: ClientRequestOptions): Promise<unknown> {
		let url = `${this._opts.endpoint}${options.path}`;
		if (options.query) {
			// Values are normalized to well-formed UTF-16 first: unlike `URLSearchParams`,
			// `encodeURIComponent` throws `URIError: URI malformed` on an unpaired surrogate.
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

		const controller = new this._AbortControllerImpl();

		const tryOnce = (): Promise<unknown> => {
			const opts: RequestInit = {
				method: options.method,
				body: options.body !== undefined ? JSON.stringify(options.body, null, 0) : undefined,
				signal: controller.signal,
				keepalive: this._opts.keepalive,
			};

			if (options.auth === true) {
				console.warn(
					"[ABsmartly] The `auth` option is deprecated. Auth headers are now sent by default. Remove `auth: true` from your request options."
				);
			}

			if (options.auth !== false) {
				opts.headers = {
					"Content-Type": "application/json",
					"X-API-Key": this._opts.apiKey,
					"X-Agent": this._opts.agent,
					"X-Environment": this._opts.environment,
					"X-Application": this._opts.application.name,
					"X-Application-Version": String(this._opts.application.version),
				};
			}

			return this._fetchImpl(url, opts).then((response: Response) => {
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
		type TryWithFn = ((retries: number, timeout: number, tries?: number, waited?: number) => Promise<unknown>) & {
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
				// timeout <= 0 means "no deadline": the retry budget is governed by
				// `retries` alone, so the elapsed-time check below must not apply.
				const hasDeadline = timeout > 0;

				if (reason._bail || retries <= 0) throw new Error(reason.message);
				if (tries >= retries) throw new RetryError(tries, reason, url);
				if ((hasDeadline && waited >= timeout) || reason.name === "AbortError") {
					if (tryWith.timedout) throw new TimeoutError(timeout);
					throw reason;
				}

				let delay = (1 << tries) * this._delay + 0.5 * Math.random() * this._delay;
				if (hasDeadline && waited + delay > timeout) delay = timeout - waited;

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

		const timeout = options.timeout ?? this._opts.timeout ?? 0;
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

		return tryWith(this._opts.retries ?? DEFAULT_RETRIES, timeout)
			.then((value) => {
				finalCleanUp();
				return value;
			})
			.catch((error: Error) => {
				finalCleanUp();
				throw error;
			});
	}

	post(options: ClientRequestOptions): Promise<unknown> {
		return this.request({ ...options, method: "POST" });
	}

	put(options: ClientRequestOptions): Promise<unknown> {
		return this.request({ ...options, method: "PUT" });
	}

	getAgent(): string {
		return this._opts.agent;
	}

	getApplication(): ApplicationObject {
		return this._opts.application;
	}

	getEnvironment(): string {
		return this._opts.environment;
	}

	get(options: ClientRequestOptions): Promise<unknown> {
		return this.request({ ...options, method: "GET" });
	}

	/** @deprecated Use get() instead. */
	getUnauthed(options: ClientRequestOptions): Promise<unknown> {
		return this.get(options);
	}
}
