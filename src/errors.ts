export class TimeoutError extends Error {
	timeout: number;
	constructor(timeout: number) {
		super("Timeout exceeded.");
		this.name = "TimeoutError";
		this.timeout = timeout;
	}
}

export class RetryError extends Error {
	retries: number;
	constructor(retries: number) {
		super("Retries exhausted.");
		this.name = "RetryError";
		this.retries = retries;
	}
}

export class AbortError extends Error {
	error: Error | string;
	constructor(error?: Error | string) {
		super("The user aborted a request.");
		this.name = "AbortError";
		this.error = error;
	}
}
