import { describe, expect, test, vi } from "vitest";
import { SDK } from "../sdk";
import type { Client, ClientOptions } from "../interfaces";

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

	test("explicitly undefined client options keep their defaults", () => {
		const sdk = new SDK({ ...defaultOpts, agent: undefined } as never);
		expect(sdk.getClient().getAgent()).toBe("absmartly-javascript-sdk");
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
			"Unit 'session_id' UID is of unsupported type 'boolean'. UID must be one of ['string', 'number']"
		);
	});

	test("createContext throws a validation error when units are missing", () => {
		const sdk = new SDK(defaultOpts);
		expect(() => sdk.createContext({} as never)).toThrow("Missing 'units' in context params");
		expect(() => sdk.createContextWith({ units: null } as never, { experiments: [] })).toThrow(
			"Missing 'units' in context params"
		);
	});

	test("accepts a custom client without connection options", () => {
		const client: Client = {
			getContext: vi.fn().mockResolvedValue({ experiments: [] }),
			publish: vi.fn().mockResolvedValue({}),
			getAgent: () => "my-custom-client",
			getApplication: () => ({ name: "my-app", version: "1.0.0" }),
			getEnvironment: () => "production",
		};

		// Must compile without apiKey/application/endpoint/environment (see README "Custom Client").
		const sdk = new SDK({ client });
		expect(sdk.getClient()).toBe(client);
	});

	test("createContext rejects array units in context params", () => {
		const sdk = new SDK(defaultOpts);
		for (const units of [["user-id"], []]) {
			expect(() => sdk.createContextWith({ units } as never, { experiments: [] })).toThrow(
				"Missing 'units' in context params"
			);
		}
	});

	test("createContext validates empty string units", () => {
		const sdk = new SDK(defaultOpts);
		expect(() => sdk.createContext({ units: { session_id: "" } })).toThrow("Unit 'session_id' UID length must be >= 1");
	});

	test("createContext applies attributes from context params", () => {
		const sdk = new SDK(defaultOpts);
		const context = sdk.createContextWith(
			{ units: { session_id: "abc" }, attributes: { user_type: "returning", age: 21 } },
			{ experiments: [] }
		);
		expect(context.getAttributes()).toEqual({ user_type: "returning", age: 21 });
	});

	test("createContext does not leave the started fetch unhandled when initial params throw", async () => {
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);
		try {
			const sdk = new SDK(defaultOpts);
			sdk.setContextDataProvider({
				getContextData: () => Promise.reject(new Error("transport error")),
			} as never);

			expect(() => sdk.createContext({ units: { session_id: "abc" }, attributes: { "": true } })).toThrow(
				"Attribute name must be a non-empty string"
			);
			expect(() => sdk.createContext({ units: { session_id: " " } })).toThrow(
				"Unit 'session_id' UID must not be blank."
			);

			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(unhandled).not.toHaveBeenCalled();
		} finally {
			process.off("unhandledRejection", unhandled);
		}
	});

	test("createContext rejects non-object attributes in context params", () => {
		const sdk = new SDK(defaultOpts);
		for (const attributes of ["x", 1, [["a", 1]]]) {
			expect(() =>
				sdk.createContextWith({ units: { session_id: "abc" }, attributes } as never, { experiments: [] })
			).toThrow("Context params 'attributes' must be an object");
		}
	});

	test("createContext returns Context instance", () => {
		const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ experiments: [] }) });
		const sdk = new SDK({ ...defaultOpts, fetchImpl });
		const context = sdk.createContext({ units: { session_id: "abc" } });
		expect(context).toBeDefined();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
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

	test("accepts custom client via SDKOptions", () => {
		const mockClient = {
			getContext: vi.fn().mockResolvedValue({ experiments: [] }),
			publish: vi.fn().mockResolvedValue("ok"),
			getAgent: vi.fn().mockReturnValue("custom-agent"),
			getApplication: vi.fn().mockReturnValue({ name: "custom-app", version: 0 }),
			getEnvironment: vi.fn().mockReturnValue("custom-env"),
		};
		const sdk = new SDK({ ...defaultOpts, client: mockClient } as any);
		expect(sdk.getClient()).toBe(mockClient);
	});

	test("event logger fires ready event on createContextWith", () => {
		const logger = vi.fn();
		const sdk = new SDK({ ...defaultOpts, eventLogger: logger });
		const context = sdk.createContextWith({ units: { session_id: "abc" } }, { experiments: [] });
		expect(logger).toHaveBeenCalledWith(context, "ready", expect.anything());
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
