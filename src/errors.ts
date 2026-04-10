export class ABSmartlyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ABSmartlyError";
	}
}

export class ContextNotReadyError extends ABSmartlyError {
	constructor() {
		super("Context is not yet ready");
		this.name = "ContextNotReadyError";
	}
}

export class ContextFinalizedError extends ABSmartlyError {
	constructor() {
		super("Context has been finalized");
		this.name = "ContextFinalizedError";
	}
}

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
	constructor(message?: string) {
		super(message);
		this.name = "AbortError";
	}
}
