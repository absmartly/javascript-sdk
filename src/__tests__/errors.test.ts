import { describe, expect, test } from "vitest";
import { AbortError, RetryError, TimeoutError } from "../errors";

describe("TimeoutError", () => {
	test("has correct name, message, and timeout", () => {
		const error = new TimeoutError(3000);
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(TimeoutError);
		expect(error.name).toBe("TimeoutError");
		expect(error.message).toBe("Timeout exceeded.");
		expect(error.timeout).toBe(3000);
	});
});

describe("RetryError", () => {
	test("has correct name, message, retries, and exception", () => {
		const cause = new Error("connection refused");
		const error = new RetryError(5, cause, "https://example.com/api");
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(RetryError);
		expect(error.name).toBe("RetryError");
		expect(error.message).toBe("Retries exhausted. URL: https://example.com/api - Last Error: connection refused");
		expect(error.retries).toBe(5);
		expect(error.exception).toBe(cause);
	});
});

describe("AbortError", () => {
	test("has correct name and default message", () => {
		const error = new AbortError();
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(AbortError);
		expect(error.name).toBe("AbortError");
	});

	test("accepts custom message", () => {
		const error = new AbortError("user cancelled");
		expect(error.message).toBe("user cancelled");
	});
});
