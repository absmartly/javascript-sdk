export class TimeoutError extends Error {
	readonly timeout: number;
	constructor(timeout: number) {
		super("Timeout exceeded.");
		this.name = "TimeoutError";
		this.timeout = timeout;
	}
}

export class RetryError extends Error {
	readonly retries: number;
	readonly exception: Error;
	constructor(retries: number, reason: Error, url: string) {
		super(`Retries exhausted. URL: ${url} - Last Error: ${reason.message}`);
		this.name = "RetryError";
		this.retries = retries;
		this.exception = reason;
	}
}

export class AbortError extends Error {
	constructor() {
		super("The user aborted a request.");
		this.name = "AbortError";
	}
}
