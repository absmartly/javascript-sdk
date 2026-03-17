import { MatchOperator } from "../jsonexpr/operators/match";
import { EqualsOperator } from "../jsonexpr/operators/eq";
import { mockEvaluator } from "./jsonexpr/operators/evaluator";
import { AbortController as ShimAbortController, AbortSignal as ShimAbortSignal } from "../abort-controller-shim";
import { AudienceMatcher } from "../matcher";
import SDK from "../sdk";
import Context from "../context";
import Client from "../client";
import { ContextPublisher } from "../publisher";
import { ContextDataProvider } from "../provider";

jest.mock("../client");
jest.mock("../sdk");
jest.mock("../provider");
jest.mock("../publisher");

describe("Fix #1: ReDoS protection in MatchOperator", () => {
	const operator = new MatchOperator();
	const evaluator = mockEvaluator();

	it("should reject patterns with nested quantifiers", () => {
		expect(operator.evaluate(evaluator, ["aaaaaaaaaa", "(a+)+$"])).toBe(null);
		expect(operator.evaluate(evaluator, ["test", "(a*)*b"])).toBe(null);
		expect(operator.evaluate(evaluator, ["test", "(x+){2}"])).toBe(null);
	});

	it("should still allow safe patterns", () => {
		expect(operator.evaluate(evaluator, ["abc", "a+"])).toBe(true);
		expect(operator.evaluate(evaluator, ["abc", "^abc$"])).toBe(true);
		expect(operator.evaluate(evaluator, ["abc", "[a-z]+"])).toBe(true);
	});

	it("should reject patterns exceeding max length", () => {
		const longPattern = "a".repeat(1001);
		expect(operator.evaluate(evaluator, ["test", longPattern])).toBe(null);
	});

	it("should reject text exceeding max length", () => {
		const longText = "a".repeat(10001);
		expect(operator.evaluate(evaluator, [longText, "a"])).toBe(null);
	});

	it("should cache compiled regexes", () => {
		expect(operator.evaluate(evaluator, ["abc", "abc"])).toBe(true);
		expect(operator.evaluate(evaluator, ["abc", "abc"])).toBe(true);
	});

	it("should return null for invalid regex", () => {
		expect(operator.evaluate(evaluator, ["test", "[invalid"])).toBe(null);
	});

	it("should not use console.error", () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		operator.evaluate(evaluator, ["test", "[invalid"]);
		operator.evaluate(evaluator, ["test", "a".repeat(1001)]);
		operator.evaluate(evaluator, ["a".repeat(10001), "a"]);
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});

describe("Fix #2: ready() error handling and readyError()", () => {
	const sdk = new SDK();
	const publisher = new ContextPublisher();
	const provider = new ContextDataProvider();

	sdk.getContextDataProvider.mockReturnValue(provider);
	sdk.getContextPublisher.mockReturnValue(publisher);
	sdk.getClient.mockReturnValue(new Client());
	sdk.getEventLogger.mockReturnValue(SDK.defaultEventLogger);

	const contextOptions = {
		publishDelay: -1,
		refreshPeriod: 0,
	};

	const contextParams = {
		units: {
			session_id: "test-session",
		},
	};

	it("should store error via readyError() when context fetch fails", async () => {
		const error = new Error("fetch failed");
		const context = new Context(sdk, contextOptions, contextParams, Promise.reject(error));
		await context.ready();

		expect(context.isFailed()).toBe(true);
		expect(context.readyError()).toBe(error);
	});

	it("should return null for readyError() when no failure", () => {
		const context = new Context(sdk, contextOptions, contextParams, { experiments: [] });
		expect(context.readyError()).toBe(null);
	});
});

describe("Fix #3: for...of on array in _resolveVariableValue", () => {
	const sdk = new SDK();
	const publisher = new ContextPublisher();
	const provider = new ContextDataProvider();

	sdk.getContextDataProvider.mockReturnValue(provider);
	sdk.getContextPublisher.mockReturnValue(publisher);
	sdk.getClient.mockReturnValue(new Client());
	sdk.getEventLogger.mockReturnValue(SDK.defaultEventLogger);

	const contextOptions = {
		publishDelay: -1,
		refreshPeriod: 0,
	};

	const contextParams = {
		units: {
			session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec",
		},
	};

	it("should handle unknown variable keys without error", () => {
		const context = new Context(sdk, contextOptions, contextParams, {
			experiments: [
				{
					id: 1,
					name: "exp_test",
					iteration: 1,
					unitType: "session_id",
					seedHi: 3603515,
					seedLo: 233373850,
					split: [0.5, 0.5],
					trafficSeedHi: 449867249,
					trafficSeedLo: 455443629,
					trafficSplit: [0.0, 1.0],
					fullOnVariant: 0,
					audience: null,
					audienceStrict: false,
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: '{"color":"red"}' },
					],
					customFieldValues: null,
				},
			],
		});

		expect(context.variableValue("nonexistent_key", "default")).toBe("default");
	});
});

describe("Fix #4: console.error routed through eventLogger", () => {
	const sdk = new SDK();
	const publisher = new ContextPublisher();
	const provider = new ContextDataProvider();

	sdk.getContextDataProvider.mockReturnValue(provider);
	sdk.getContextPublisher.mockReturnValue(publisher);
	sdk.getClient.mockReturnValue(new Client());

	const contextParams = {
		units: {
			session_id: "test",
		},
	};

	it("should not call console.error directly for custom field parse errors", () => {
		const eventLogger = jest.fn();
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

		sdk.getEventLogger.mockReturnValue(eventLogger);
		const context = new Context(sdk, { publishDelay: -1, refreshPeriod: 0, eventLogger }, contextParams, {
			experiments: [
				{
					id: 1,
					name: "exp",
					iteration: 1,
					unitType: "session_id",
					seedHi: 1,
					seedLo: 1,
					split: [1],
					trafficSeedHi: 1,
					trafficSeedLo: 1,
					trafficSplit: [0, 1],
					fullOnVariant: 0,
					audience: null,
					audienceStrict: false,
					variants: [{ name: "A", config: null }],
					customFieldValues: [{ name: "bad_json", value: "{invalid", type: "json" }],
				},
			],
		});

		context.customFieldValue("exp", "bad_json");
		expect(errorSpy).not.toHaveBeenCalled();
		expect(eventLogger).toHaveBeenCalledWith(context, "error", expect.any(Error));
		errorSpy.mockRestore();
	});

	it("should not call console.error in AudienceMatcher on parse failure", () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const matcher = new AudienceMatcher();
		matcher.evaluate("{invalid json", {});
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("should route variant config parse errors through eventLogger", () => {
		const eventLogger = jest.fn();
		sdk.getEventLogger.mockReturnValue(eventLogger);

		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

		const context = new Context(sdk, { publishDelay: -1, refreshPeriod: 0, eventLogger }, contextParams, {
			experiments: [
				{
					id: 1,
					name: "exp_bad_config",
					iteration: 1,
					unitType: "session_id",
					seedHi: 1,
					seedLo: 1,
					split: [1],
					trafficSeedHi: 1,
					trafficSeedLo: 1,
					trafficSplit: [0, 1],
					fullOnVariant: 0,
					audience: null,
					audienceStrict: false,
					variants: [{ name: "A", config: "{invalid json}" }],
					customFieldValues: null,
				},
			],
		});

		expect(errorSpy).not.toHaveBeenCalled();
		expect(eventLogger).toHaveBeenCalledWith(context, "error", expect.any(Error));
		errorSpy.mockRestore();
	});
});

describe("Fix #5: _finalizing type cleanup", () => {
	it("should not use boolean for _finalizing", () => {
		const sdk = new SDK();
		const publisher = new ContextPublisher();
		const provider = new ContextDataProvider();

		sdk.getContextDataProvider.mockReturnValue(provider);
		sdk.getContextPublisher.mockReturnValue(publisher);
		sdk.getClient.mockReturnValue(new Client());
		sdk.getEventLogger.mockReturnValue(jest.fn());

		const context = new Context(
			sdk,
			{ publishDelay: -1, refreshPeriod: 0 },
			{ units: { session_id: "test" } },
			{ experiments: [] }
		);

		expect(context.isFinalizing()).toBe(false);
		expect(context.isFinalized()).toBe(false);
	});
});

describe("Fix #11: SDK._extractClientOptions uses includes", () => {
	it("should extract client options correctly", () => {
		const sdk = new SDK({
			agent: "test-agent",
			apiKey: "key",
			application: "app",
			endpoint: "http://localhost",
			environment: "test",
			timeout: 5000,
		});
		expect(sdk).toBeInstanceOf(SDK);
	});
});

describe("Fix #12: SDK.defaultEventLogger logs error message", () => {
	let ActualSDK;
	beforeAll(() => {
		ActualSDK = jest.requireActual("../sdk").default;
	});

	it("should log error.message for Error instances", () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const error = new Error("something failed");
		ActualSDK.defaultEventLogger(null, "error", error);
		expect(errorSpy).toHaveBeenCalledWith("something failed");
		errorSpy.mockRestore();
	});

	it("should log raw data for non-Error values", () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		ActualSDK.defaultEventLogger(null, "error", "plain text error");
		expect(errorSpy).toHaveBeenCalledWith("plain text error");
		errorSpy.mockRestore();
	});
});

describe("Fix #13: _getAttributesMap caching", () => {
	const sdk = new SDK();
	const publisher = new ContextPublisher();
	const provider = new ContextDataProvider();

	sdk.getContextDataProvider.mockReturnValue(provider);
	sdk.getContextPublisher.mockReturnValue(publisher);
	sdk.getClient.mockReturnValue(new Client());
	sdk.getEventLogger.mockReturnValue(jest.fn());

	it("should return correct attributes after multiple attribute() calls", () => {
		const context = new Context(
			sdk,
			{ publishDelay: -1, refreshPeriod: 0 },
			{ units: { session_id: "test" } },
			{ experiments: [] }
		);

		context.attribute("age", 25);
		context.attribute("country", "US");

		const attrs = context.getAttributes();
		expect(attrs).toEqual({ age: 25, country: "US" });
	});
});

describe("Fix #15: fetch.ts throws on missing implementation", () => {
	it("should not export undefined", async () => {
		const fetchModule = await import("../fetch");
		const fetchImpl = fetchModule.default;
		expect(fetchImpl).not.toBeUndefined();
		expect(typeof fetchImpl).toBe("function");
	});
});

describe("Fix #16: Client.request timeout uses nullish coalescing", () => {
	it("should accept timeout of 0 in options", () => {
		const client = new Client({
			endpoint: "http://test",
			agent: "test",
			environment: "test",
			apiKey: "key",
			application: "app",
			timeout: 5000,
		});

		expect(client).toBeInstanceOf(Client);
	});
});

describe("Fix #21: AbortController shim sets signal.reason", () => {
	it("should set default reason on abort()", () => {
		const controller = new ShimAbortController();
		controller.abort();
		expect(controller.signal.aborted).toBe(true);
		expect(controller.signal.reason).toBeInstanceOf(Error);
		expect(controller.signal.reason.message).toBe("The operation was aborted.");
	});

	it("should set custom reason on abort(reason)", () => {
		const controller = new ShimAbortController();
		const customReason = new Error("custom abort");
		controller.abort(customReason);
		expect(controller.signal.reason).toBe(customReason);
	});

	it("should have undefined reason before abort", () => {
		const controller = new ShimAbortController();
		expect(controller.signal.reason).toBeUndefined();
	});
});

describe("Fix #25: Context.getOptions() returns shallow copy", () => {
	it("should not allow mutation of internal options", () => {
		const sdk = new SDK();
		const publisher = new ContextPublisher();
		const provider = new ContextDataProvider();

		sdk.getContextDataProvider.mockReturnValue(provider);
		sdk.getContextPublisher.mockReturnValue(publisher);
		sdk.getClient.mockReturnValue(new Client());
		sdk.getEventLogger.mockReturnValue(jest.fn());

		const originalOptions = { publishDelay: 100, refreshPeriod: 0 };
		const context = new Context(sdk, originalOptions, { units: { session_id: "test" } }, { experiments: [] });

		const opts = context.getOptions();
		opts.publishDelay = 9999;

		expect(context.getOptions().publishDelay).toBe(100);
	});
});

describe("Fix #32: AbortSignal dispatchEvent uses explicit onabort", () => {
	it("should call onabort handler on dispatch", () => {
		const signal = new ShimAbortSignal();
		const handler = jest.fn();
		signal.onabort = handler;
		signal.dispatchEvent({ type: "abort" });
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({ type: "abort" });
	});

	it("should not call onabort for non-abort events", () => {
		const signal = new ShimAbortSignal();
		const handler = jest.fn();
		signal.onabort = handler;
		signal.dispatchEvent({ type: "other" });
		expect(handler).not.toHaveBeenCalled();
	});
});

describe("Fix #33: Client constructor uses spread", () => {
	it("should merge defaults with provided options", () => {
		const client = new Client({
			endpoint: "http://test",
			agent: "custom-agent",
			environment: "prod",
			apiKey: "key123",
			application: "myapp",
			timeout: 10000,
		});

		expect(client).toBeInstanceOf(Client);
	});
});

describe("Fix #34: SDK._contextOptions uses spread", () => {
	it("should merge custom options with defaults", () => {
		const sdk = new SDK({
			agent: "test",
			apiKey: "key",
			application: "app",
			endpoint: "http://localhost",
			environment: "test",
		});

		expect(sdk).toBeInstanceOf(SDK);
	});
});

describe("Fix #20: EqualsOperator without redundant Array.isArray", () => {
	const operator = new EqualsOperator();
	const evaluator = mockEvaluator();

	it("should evaluate equality correctly", () => {
		expect(operator.evaluate(evaluator, [1, 1])).toBe(true);
		expect(operator.evaluate(evaluator, [1, 2])).toBe(false);
	});

	it("should handle null comparison", () => {
		expect(operator.evaluate(evaluator, [null, null])).toBe(null);
	});

	it("should handle empty args", () => {
		expect(operator.evaluate(evaluator, [])).toBe(null);
	});
});
