import { describe, expect, test, vi } from "vitest";
import { SDK } from "../sdk";
import type { ClientOptions } from "../types";

const defaultOpts: ClientOptions = {
	agent: "test-agent",
	apiKey: "test-api-key",
	application: "test-app",
	endpoint: "https://test.absmartly.io/v1",
	environment: "test",
};

describe("SDK", () => {
	test("creates SDK instance", () => {
		const sdk = new SDK(defaultOpts);
		expect(sdk).toBeInstanceOf(SDK);
	});

	test("getClient returns client", () => {
		const sdk = new SDK(defaultOpts);
		expect(sdk.getClient()).toBeDefined();
	});

	test("get/set event logger", () => {
		const sdk = new SDK(defaultOpts);
		const logger = vi.fn();
		sdk.setEventLogger(logger);
		expect(sdk.getEventLogger()).toBe(logger);
	});

	test("default event logger logs errors", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const error = new Error("test");
		SDK.defaultEventLogger({} as never, "error", error);
		expect(consoleSpy).toHaveBeenCalledWith(error);
		consoleSpy.mockRestore();
	});

	test("createContext validates unit types", () => {
		const sdk = new SDK(defaultOpts);
		expect(() => sdk.createContext({ units: { session_id: true as unknown as string } })).toThrow(
			"Unit 'session_id' UID is of unsupported type 'boolean'. UID must be one of ['string', 'number']",
		);
	});

	test("createContext validates empty string units", () => {
		const sdk = new SDK(defaultOpts);
		expect(() => sdk.createContext({ units: { session_id: "" } })).toThrow(
			"Unit 'session_id' UID length must be >= 1",
		);
	});

	test("createContext returns Context instance", () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ experiments: [] }) }),
		);
		const sdk = new SDK(defaultOpts);
		const context = sdk.createContext({ units: { session_id: "abc" } });
		expect(context).toBeDefined();
		vi.restoreAllMocks();
	});

	test("createContextWith accepts pre-fetched data", () => {
		const sdk = new SDK(defaultOpts);
		const context = sdk.createContextWith({ units: { session_id: "abc" } }, { experiments: [] });
		expect(context).toBeDefined();
		expect(context.isReady()).toBe(true);
	});

	test("get/set context publisher", () => {
		const sdk = new SDK(defaultOpts);
		const publisher = { publish: vi.fn() };
		sdk.setContextPublisher(publisher as never);
		expect(sdk.getContextPublisher()).toBe(publisher);
	});

	test("get/set context data provider", () => {
		const sdk = new SDK(defaultOpts);
		const provider = { getContextData: vi.fn() };
		sdk.setContextDataProvider(provider as never);
		expect(sdk.getContextDataProvider()).toBe(provider);
	});

	test("forwards fetchImpl and AbortControllerImpl to Client", async () => {
		const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ experiments: [] }) });
		let abortControllerInstances = 0;
		class FakeAbortController {
			signal = { addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as AbortSignal;
			constructor() {
				abortControllerInstances += 1;
			}
			abort = vi.fn();
		}

		const sdk = new SDK({
			...defaultOpts,
			fetchImpl,
			AbortControllerImpl: FakeAbortController as unknown as typeof AbortController,
		});
		const context = sdk.createContext({ units: { session_id: "abc" } });
		await context.ready();

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(abortControllerInstances).toBe(1);
	});
});

