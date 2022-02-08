export class TimeoutError extends Error {
	constructor(timeout) {
		super("Timeout exceeded.");
		this.name = "TimeoutError";
		this.timeout = timeout;
	}
}

export class RetryError extends Error {
	constructor(retries) {
		super("Retries exhausted.");
		this.name = "RetryError";
		this.retries = retries;
	}
}

export class AbortError extends Error {
	constructor() {
		super("The user aborted a request.");
		this.name = "AbortError";
	}
}
