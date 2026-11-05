import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { DefaultClient } from "../client";
import type { ClientOptions } from "../interfaces";

const defaultOpts: ClientOptions = {
	agent: "test-agent",
	apiKey: "test-api-key",
	application: "test-app",
	endpoint: "https://test.absmartly.io/v1",
	environment: "test",
};

describe("Client", () => {
	let fetchImpl: ReturnType<typeof vi.fn>;

	describe("constructor validation", () => {
		test("throws for missing apiKey", () => {
			const opts = { ...defaultOpts, apiKey: undefined } as unknown as ClientOptions;
			expect(() => new DefaultClient(opts)).toThrow("Missing 'apiKey' in options argument");
		});

		test("uses injected fetch implementation", async () => {
			const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ experiments: [] }) });
			const client = new DefaultClient({ ...defaultOpts, retries: 0, timeout: 1000, fetchImpl });
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
			const client = new DefaultClient({
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
			expect(() => new DefaultClient(opts)).toThrow("Missing 'endpoint' in options argument");
		});

		test("throws for missing environment", () => {
			const opts = { ...defaultOpts, environment: undefined } as unknown as ClientOptions;
			expect(() => new DefaultClient(opts)).toThrow("Missing 'environment' in options argument");
		});

		test("throws for missing application", () => {
			const opts = { ...defaultOpts, application: undefined } as unknown as ClientOptions;
			expect(() => new DefaultClient(opts)).toThrow("Missing 'application' in options argument");
		});

		test("throws for empty apiKey", () => {
			const opts = { ...defaultOpts, apiKey: "" };
			expect(() => new DefaultClient(opts)).toThrow("Invalid 'apiKey' in options argument");
		});

		test("accepts ApplicationObject", () => {
			const opts = { ...defaultOpts, application: { name: "my-app", version: "1.0.0" } };
			const client = new DefaultClient(opts);
			expect(client.getApplication()).toEqual({ name: "my-app", version: "1.0.0" });
		});

		test("converts string application to ApplicationObject", () => {
			const client = new DefaultClient(defaultOpts);
			expect(client.getApplication()).toEqual({ name: "test-app", version: 0 });
		});
	});

	describe("accessors", () => {
		test("getAgent", () => {
			const client = new DefaultClient(defaultOpts);
			expect(client.getAgent()).toBe("test-agent");
		});

		test("getEnvironment", () => {
			const client = new DefaultClient(defaultOpts);
			expect(client.getEnvironment()).toBe("test");
		});
	});

	describe("getContext", () => {
		beforeEach(() => {
			fetchImpl = vi.fn();
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		test("makes GET request to /context", async () => {
			const mockResponse = { ok: true, json: () => Promise.resolve({ experiments: [] }) };
			fetchImpl.mockResolvedValue(mockResponse);

			const client = new DefaultClient({ ...defaultOpts, fetchImpl, retries: 0, timeout: 1000 });
			await client.getContext();

			expect(fetchImpl).toHaveBeenCalledTimes(1);
			const [url] = fetchImpl.mock.calls[0]!;
			expect(url).toContain("/context");
			expect(url).toContain("application=test-app");
			expect(url).toContain("environment=test");
		});

		test("GET /context includes auth headers", async () => {
			const mockResponse = { ok: true, json: () => Promise.resolve({ experiments: [] }) };
			fetchImpl.mockResolvedValue(mockResponse);

			const client = new DefaultClient({ ...defaultOpts, fetchImpl, retries: 0, timeout: 1000 });
			await client.getContext();

			const [, opts] = fetchImpl.mock.calls[0]!;
			expect(opts.headers["X-API-Key"]).toBe(defaultOpts.apiKey);
			expect(opts.headers["X-Environment"]).toBe(defaultOpts.environment);
		});
	});

	describe("publish", () => {
		beforeEach(() => {
			fetchImpl = vi.fn();
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		test("makes PUT request to /context with auth headers", async () => {
			const mockResponse = { ok: true, json: () => Promise.resolve({}) };
			fetchImpl.mockResolvedValue(mockResponse);

			const client = new DefaultClient({ ...defaultOpts, fetchImpl, retries: 0, timeout: 1000 });
			await client.publish({
				units: [{ type: "session_id", uid: "abc" }],
				publishedAt: 1000,
				hashed: true,
				sdkVersion: "2.0.0",
			});

			const [, opts] = fetchImpl.mock.calls[0]!;
			expect(opts.method).toBe("PUT");
			expect(opts.headers["X-API-Key"]).toBe("test-api-key");
			expect(opts.headers["X-Agent"]).toBe("test-agent");
			expect(opts.headers["X-Environment"]).toBe("test");
		});

		test("omits empty goals and exposures arrays", async () => {
			const mockResponse = { ok: true, json: () => Promise.resolve({}) };
			fetchImpl.mockResolvedValue(mockResponse);

			const client = new DefaultClient({ ...defaultOpts, fetchImpl, retries: 0, timeout: 1000 });
			await client.publish({
				units: [{ type: "session_id", uid: "abc" }],
				publishedAt: 1000,
				hashed: true,
				sdkVersion: "2.0.0",
				goals: [],
				exposures: [],
			});

			const [, opts] = fetchImpl.mock.calls[0]!;
			const body = JSON.parse(opts.body);
			expect(body.goals).toBeUndefined();
			expect(body.exposures).toBeUndefined();
		});
	});

	describe("retry logic", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			fetchImpl = vi.fn();
		});

		afterEach(() => {
			vi.useRealTimers();
			vi.restoreAllMocks();
		});

		test("retries on server error", async () => {
			const failResponse = { ok: false, status: 500, statusText: "Server Error", text: () => Promise.resolve("") };
			const successResponse = { ok: true, json: () => Promise.resolve({ data: "ok" }) };

			fetchImpl.mockResolvedValueOnce(failResponse).mockResolvedValueOnce(successResponse);

			const client = new DefaultClient({ ...defaultOpts, fetchImpl, retries: 3, timeout: 10000 });
			const promise = client.getContext();

			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toEqual({ data: "ok" });
			expect(fetchImpl).toHaveBeenCalledTimes(2);
		});

		test("does not retry on 4xx error", async () => {
			const failResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: () => Promise.resolve("bad request"),
			};

			fetchImpl.mockResolvedValue(failResponse);

			const client = new DefaultClient({ ...defaultOpts, fetchImpl, retries: 3, timeout: 10000 });
			const promise = client.getContext();

			await expect(promise).rejects.toThrow("bad request");
			expect(fetchImpl).toHaveBeenCalledTimes(1);

			await vi.runAllTimersAsync();
		});
	});

	describe("request()", () => {
		const okResponse = (body: unknown = {}) => ({ ok: true, json: () => Promise.resolve(body) });

		test("does not throw on unmatched surrogates in query parameters", async () => {
			// encodeURIComponent() throws URIError on a lone surrogate, so it is normalized to U+FFFD first.
			const fetchImpl = vi.fn().mockResolvedValue(okResponse());
			const client = new DefaultClient({ ...defaultOpts, retries: 0, timeout: 1000, fetchImpl });

			await client.request({ method: "GET", path: "/context", query: { application: "\uD800" } });

			expect(fetchImpl).toHaveBeenCalledWith(
				`${defaultOpts.endpoint}/context?application=%EF%BF%BD`,
				expect.any(Object)
			);
		});

		test("does not send headers when auth is false", async () => {
			const fetchImpl = vi.fn().mockResolvedValue(okResponse());
			const client = new DefaultClient({ ...defaultOpts, retries: 0, timeout: 1000, fetchImpl });

			await client.get({ path: "/context", auth: false });

			expect(fetchImpl.mock.calls[0]![1].headers).toBeUndefined();
		});

		test("still sends headers and warns when auth is explicitly true (deprecated)", async () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const fetchImpl = vi.fn().mockResolvedValue(okResponse());
			const client = new DefaultClient({ ...defaultOpts, retries: 0, timeout: 1000, fetchImpl });

			await client.get({ path: "/context", auth: true });

			expect(fetchImpl.mock.calls[0]![1].headers["X-API-Key"]).toBe(defaultOpts.apiKey);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining("`auth` option is deprecated"));
			warn.mockRestore();
		});

		test("get() sends a GET request with headers", async () => {
			const fetchImpl = vi.fn().mockResolvedValue(okResponse());
			const client = new DefaultClient({ ...defaultOpts, retries: 0, timeout: 1000, fetchImpl });

			await client.get({ path: "/context" });

			const [url, opts] = fetchImpl.mock.calls[0]!;
			expect(url).toBe(`${defaultOpts.endpoint}/context`);
			expect(opts.method).toBe("GET");
			expect(opts.headers["X-API-Key"]).toBe(defaultOpts.apiKey);
		});

		test("getUnauthed() forwards to get()", async () => {
			const fetchImpl = vi.fn().mockResolvedValue(okResponse());
			const client = new DefaultClient({ ...defaultOpts, retries: 0, timeout: 1000, fetchImpl });
			const get = vi.spyOn(client, "get");

			await client.getUnauthed({ path: "/context" });

			expect(get).toHaveBeenCalledWith({ path: "/context" });
		});

		test("still retries a failing-then-succeeding request when timeout is 0 (no deadline)", async () => {
			vi.useFakeTimers();
			try {
				const failResponse = { ok: false, status: 500, statusText: "Server Error", text: () => Promise.resolve("") };
				const fetchImpl = vi
					.fn()
					.mockResolvedValueOnce(failResponse)
					.mockResolvedValueOnce(okResponse({ a: 1 }));
				const client = new DefaultClient({ ...defaultOpts, retries: 5, timeout: 0, fetchImpl });

				const promise = client.get({ path: "/context" });
				await vi.runAllTimersAsync();

				await expect(promise).resolves.toEqual({ a: 1 });
				expect(fetchImpl).toHaveBeenCalledTimes(2);
			} finally {
				vi.useRealTimers();
			}
		});
	});
});
