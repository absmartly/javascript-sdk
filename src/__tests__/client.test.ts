import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { Client } from "../client";
import type { ClientOptions } from "../types";

const defaultOpts: ClientOptions = {
	agent: "test-agent",
	apiKey: "test-api-key",
	application: "test-app",
	endpoint: "https://test.absmartly.io/v1",
	environment: "test",
};

describe("Client", () => {
	describe("constructor validation", () => {
		test("throws for missing apiKey", () => {
			const opts = { ...defaultOpts, apiKey: undefined } as unknown as ClientOptions;
			expect(() => new Client(opts)).toThrow("Missing 'apiKey' in options argument");
		});

		test("uses injected fetch implementation", async () => {
			const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ experiments: [] }) });
			const client = new Client({ ...defaultOpts, retries: 0, timeout: 1000, fetchImpl });
			await client.getContext();
			expect(fetchImpl).toHaveBeenCalledTimes(1);
		});

		test("uses injected AbortController implementation", async () => {
			const abort = vi.fn();
			class FakeAbortController {
				signal = { addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as AbortSignal;
				abort = abort;
			}
			const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ experiments: [] }) });
			const client = new Client({
				...defaultOpts,
				retries: 0,
				timeout: 1000,
				fetchImpl,
				AbortControllerImpl: FakeAbortController as unknown as typeof AbortController,
			});
			await client.getContext();
			expect(fetchImpl).toHaveBeenCalledTimes(1);
		});

		test("throws for missing endpoint", () => {
			const opts = { ...defaultOpts, endpoint: undefined } as unknown as ClientOptions;
			expect(() => new Client(opts)).toThrow("Missing 'endpoint' in options argument");
		});

		test("throws for missing environment", () => {
			const opts = { ...defaultOpts, environment: undefined } as unknown as ClientOptions;
			expect(() => new Client(opts)).toThrow("Missing 'environment' in options argument");
		});

		test("throws for missing application", () => {
			const opts = { ...defaultOpts, application: undefined } as unknown as ClientOptions;
			expect(() => new Client(opts)).toThrow("Missing 'application' in options argument");
		});

		test("throws for empty apiKey", () => {
			const opts = { ...defaultOpts, apiKey: "" };
			expect(() => new Client(opts)).toThrow("Invalid 'apiKey' in options argument");
		});

		test("accepts ApplicationObject", () => {
			const opts = { ...defaultOpts, application: { name: "my-app", version: "1.0.0" } };
			const client = new Client(opts);
			expect(client.getApplication()).toEqual({ name: "my-app", version: "1.0.0" });
		});

		test("converts string application to ApplicationObject", () => {
			const client = new Client(defaultOpts);
			expect(client.getApplication()).toEqual({ name: "test-app", version: 0 });
		});
	});

	describe("accessors", () => {
		test("getAgent", () => {
			const client = new Client(defaultOpts);
			expect(client.getAgent()).toBe("test-agent");
		});

		test("getEnvironment", () => {
			const client = new Client(defaultOpts);
			expect(client.getEnvironment()).toBe("test");
		});
	});

	describe("getContext", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		test("makes GET request to /context", async () => {
			const mockResponse = { ok: true, json: () => Promise.resolve({ experiments: [] }) };
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

			const client = new Client({ ...defaultOpts, retries: 0, timeout: 1000 });
			await client.getContext();

			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
			expect(url).toContain("/context");
			expect(url).toContain("application=test-app");
			expect(url).toContain("environment=test");
		});
	});

	describe("publish", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		test("makes PUT request to /context with auth headers", async () => {
			const mockResponse = { ok: true, json: () => Promise.resolve({}) };
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

			const client = new Client({ ...defaultOpts, retries: 0, timeout: 1000 });
			await client.publish({
				units: [{ type: "session_id", uid: "abc" }],
				publishedAt: 1000,
				hashed: true,
				sdkVersion: "2.0.0",
			});

			const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
			expect(opts.method).toBe("PUT");
			expect(opts.headers["X-API-Key"]).toBe("test-api-key");
			expect(opts.headers["X-Agent"]).toBe("test-agent");
			expect(opts.headers["X-Environment"]).toBe("test");
		});

		test("omits empty goals and exposures arrays", async () => {
			const mockResponse = { ok: true, json: () => Promise.resolve({}) };
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

			const client = new Client({ ...defaultOpts, retries: 0, timeout: 1000 });
			await client.publish({
				units: [{ type: "session_id", uid: "abc" }],
				publishedAt: 1000,
				hashed: true,
				sdkVersion: "2.0.0",
				goals: [],
				exposures: [],
			});

			const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
			const body = JSON.parse(opts.body);
			expect(body.goals).toBeUndefined();
			expect(body.exposures).toBeUndefined();
		});
	});

	describe("retry logic", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.stubGlobal("fetch", vi.fn());
		});

		afterEach(() => {
			vi.useRealTimers();
			vi.restoreAllMocks();
		});

		test("retries on server error", async () => {
			const failResponse = { ok: false, status: 500, statusText: "Server Error", text: () => Promise.resolve("") };
			const successResponse = { ok: true, json: () => Promise.resolve({ data: "ok" }) };

			(globalThis.fetch as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(failResponse)
				.mockResolvedValueOnce(successResponse);

			const client = new Client({ ...defaultOpts, retries: 3, timeout: 10000 });
			const promise = client.getContext();

			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toEqual({ data: "ok" });
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		test("does not retry on 4xx error", async () => {
			const failResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: () => Promise.resolve("bad request"),
			};

			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(failResponse);

			const client = new Client({ ...defaultOpts, retries: 3, timeout: 10000 });
			const promise = client.getContext();

			await expect(promise).rejects.toThrow("bad request");
			expect(globalThis.fetch).toHaveBeenCalledTimes(1);

			await vi.runAllTimersAsync();
		});
	});
});
