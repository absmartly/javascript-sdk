import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Context } from "../context";
import { ContextPublisher } from "../publisher";
import { ContextDataProvider } from "../provider";
import { hashUnit } from "../hashing";
import { SDK_VERSION } from "../version";

function clone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

describe("Context", () => {
	const contextParams = {
		units: {
			session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec",
			user_id: 12317303,
		},
	};

	const publishUnits = Object.entries(contextParams.units).map((x) => ({ type: x[0], uid: hashUnit(x[1]) }));

	const units = {
		session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec",
		user_id: "123456789",
		email: "bleh@absmartly.com",
	};

	const getContextResponse = {
		experiments: [
			{
				id: 1,
				name: "exp_test_ab",
				iteration: 1,
				unitType: "session_id",
				seedHi: 3603515,
				seedLo: 233373850,
				split: [0.5, 0.5],
				trafficSeedHi: 449867249,
				trafficSeedLo: 455443629,
				trafficSplit: [0.0, 1.0],
				fullOnVariant: 0,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: '{"banner.border":1,"banner.size":"large"}' },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: null,
			},
			{
				id: 2,
				name: "exp_test_abc",
				iteration: 1,
				unitType: "session_id",
				seedHi: 55006150,
				seedLo: 47189152,
				split: [0.34, 0.33, 0.33],
				trafficSeedHi: 705671872,
				trafficSeedLo: 212903484,
				trafficSplit: [0.0, 1.0],
				fullOnVariant: 0,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: '{"button.color":"blue"}' },
					{ name: "C", config: '{"button.color":"red"}' },
				],
				audience: "",
				audienceStrict: false,
				customFieldValues: [
					{ name: "country", value: "US,PT,ES,DE,FR", type: "string" },
					{ name: "json_object", value: '{"123":1,"456":0}', type: "json" },
					{ name: "json_array", value: '["hello", "world"]', type: "json" },
					{ name: "json_number", value: "123", type: "json" },
					{ name: "json_string", value: '"hello"', type: "json" },
					{ name: "json_boolean", value: "true", type: "json" },
					{ name: "json_null", value: "null", type: "json" },
					{ name: "json_invalid", value: "invalid", type: "json" },
				],
			},
			{
				id: 3,
				name: "exp_test_not_eligible",
				iteration: 1,
				unitType: "user_id",
				seedHi: 503266407,
				seedLo: 144942754,
				split: [0.34, 0.33, 0.33],
				trafficSeedHi: 87768905,
				trafficSeedLo: 511357582,
				trafficSplit: [0.99, 0.01],
				fullOnVariant: 0,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: '{"card.width":"80%"}' },
					{ name: "C", config: '{"card.width":"75%"}' },
				],
				audience: "{}",
				audienceStrict: false,
				customFieldValues: null,
			},
			{
				id: 4,
				name: "exp_test_fullon",
				iteration: 1,
				unitType: "session_id",
				seedHi: 856061641,
				seedLo: 990838475,
				split: [0.25, 0.25, 0.25, 0.25],
				trafficSeedHi: 360868579,
				trafficSeedLo: 330937933,
				trafficSplit: [0.0, 1.0],
				fullOnVariant: 2,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: '{"submit.color":"red","submit.shape":"circle"}' },
					{ name: "C", config: '{"submit.color":"blue","submit.shape":"rect"}' },
					{ name: "D", config: '{"submit.color":"green","submit.shape":"square"}' },
				],
				audience: "null",
				audienceStrict: false,
				customFieldValues: null,
			},
			{
				id: 5,
				name: "exp_test_custom_fields",
				iteration: 1,
				unitType: "session_id",
				seedHi: 9372617,
				seedLo: 121364805,
				split: [0.5, 0.5],
				trafficSeedHi: 318746944,
				trafficSeedLo: 359812364,
				trafficSplit: [0.0, 1.0],
				fullOnVariant: 0,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: '{"submit.size":"sm"}' },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: [
					{ name: "country", value: "US,PT,ES", type: "string" },
					{ name: "languages", value: "en-US,en-GB,pt-PT,pt-BR,es-ES,es-MX", type: "string" },
					{ name: "text_field", value: "hello text", type: "text" },
					{ name: "string_field", value: "hello string", type: "string" },
					{ name: "number_field", value: "123", type: "number" },
					{ name: "boolean_field", value: "true", type: "boolean" },
					{ name: "false_boolean_field", value: "false", type: "boolean" },
					{ name: "invalid_type_field", value: "invalid", type: "invalid" },
				],
			},
		],
	};

	const refreshContextResponse = {
		...getContextResponse,
		experiments: [
			{
				id: 6,
				name: "exp_test_new",
				iteration: 2,
				unitType: "session_id",
				seedHi: 934590467,
				seedLo: 714771373,
				split: [0.5, 0.5],
				trafficSeedHi: 940553836,
				trafficSeedLo: 270705624,
				trafficSplit: [0.0, 1.0],
				fullOnVariant: 1,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: '{"show-modal":true}' },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: null,
			},
			...getContextResponse.experiments,
		],
	};

	const audienceContextResponse = {
		...getContextResponse,
		experiments: getContextResponse.experiments.map((x) => {
			if (x.name === "exp_test_ab") {
				return {
					...x,
					audience: JSON.stringify({
						filter: [{ gte: [{ var: "age" }, { value: 20 }] }],
					}),
				};
			}
			return x;
		}),
	};

	const audienceStrictContextResponse = {
		...audienceContextResponse,
		experiments: audienceContextResponse.experiments.map((x) => {
			if (x.name === "exp_test_ab") {
				return {
					...x,
					audienceStrict: true,
					variants: x.variants.map((v) => {
						if (v.name === "A") {
							return { name: "A", config: '{"banner.size":"tiny"}' };
						}
						return v;
					}),
				};
			}
			return x;
		}),
	};

	const expectedVariants: Record<string, number> = {
		exp_test_ab: 1,
		exp_test_abc: 2,
		exp_test_not_eligible: 0,
		exp_test_fullon: 2,
		exp_test_new: 1,
		exp_test_custom_fields: 1,
	};

	const lowestIdConflictingKeyContextResponse = {
		...getContextResponse,
		experiments: getContextResponse.experiments.map((e) => {
			if (e.name === "exp_test_ab") {
				return {
					...e,
					id: 99,
					variants: e.variants.map((v, i) => {
						if (i === expectedVariants[e.name]) {
							return { ...v, config: JSON.stringify({ icon: "arrow" }) };
						}
						return v;
					}),
				};
			}
			if (e.name === "exp_test_abc") {
				return {
					...e,
					id: 1,
					variants: e.variants.map((v, i) => {
						if (i === expectedVariants[e.name]) {
							return { ...v, config: JSON.stringify({ icon: "circle" }) };
						}
						return v;
					}),
				};
			}
			return e;
		}),
	};

	const disjointedContextResponse = {
		...getContextResponse,
		experiments: getContextResponse.experiments.map((exp) => {
			if (exp.name === "exp_test_ab") {
				return {
					...exp,
					audienceStrict: true,
					audience: JSON.stringify({
						filter: [{ gte: [{ var: "age" }, { value: 20 }] }],
					}),
					variants: exp.variants.map((v, i) => {
						if (i === expectedVariants[exp.name]) {
							return { ...v, config: JSON.stringify({ icon: "arrow" }) };
						}
						return v;
					}),
				};
			}
			if (exp.name === "exp_test_abc") {
				return {
					...exp,
					audienceStrict: true,
					audience: JSON.stringify({
						filter: [{ lt: [{ var: "age" }, { value: 20 }] }],
					}),
					variants: exp.variants.map((variant, i) => {
						if (i === expectedVariants[exp.name]) {
							return { ...variant, config: JSON.stringify({ icon: "circle" }) };
						}
						return variant;
					}),
				};
			}
			return exp;
		}),
	};

	const expectedVariables: Record<string, unknown> = {
		"banner.border": 1,
		"banner.size": "large",
		"button.color": "red",
		"submit.color": "blue",
		"submit.shape": "rect",
		"show-modal": true,
		"submit.size": "sm",
	};

	const variableExperiments: Record<string, string[]> = {
		"banner.border": ["exp_test_ab"],
		"banner.size": ["exp_test_ab"],
		"button.color": ["exp_test_abc"],
		"card.width": ["exp_test_not_eligible"],
		"submit.color": ["exp_test_fullon"],
		"submit.shape": ["exp_test_fullon"],
		"submit.size": ["exp_test_custom_fields"],
		"show-modal": ["exp_test_new"],
	};

	const defaultEventLogger = vi.fn();

	const publisher = {
		publish: vi.fn(),
	} as unknown as ContextPublisher & { publish: ReturnType<typeof vi.fn> };

	const provider = {
		getContextData: vi.fn(),
	} as unknown as ContextDataProvider & { getContextData: ReturnType<typeof vi.fn> };

	const client = {
		getAgent: vi.fn().mockReturnValue("absmartly-javascript-sdk"),
		getApplication: vi.fn().mockReturnValue({ name: "website", version: 0 }),
		getEnvironment: vi.fn().mockReturnValue("production"),
	};

	const sdk = {
		getContextPublisher: vi.fn().mockReturnValue(publisher),
		getContextDataProvider: vi.fn().mockReturnValue(provider),
		getClient: vi.fn().mockReturnValue(client),
		getEventLogger: vi.fn().mockReturnValue(defaultEventLogger),
	};

	const contextOptions = {
		publishDelay: -1,
		refreshPeriod: 0,
	};

	const timeOrigin = 1611141535729;

	beforeEach(() => {
		vi.spyOn(Date, "now").mockImplementation(() => timeOrigin);
		vi.clearAllMocks();
		sdk.getContextPublisher.mockReturnValue(publisher);
		sdk.getContextDataProvider.mockReturnValue(provider);
		sdk.getClient.mockReturnValue(client);
		sdk.getEventLogger.mockReturnValue(defaultEventLogger);
		client.getAgent.mockReturnValue("absmartly-javascript-sdk");
		client.getApplication.mockReturnValue({ name: "website", version: 0 });
		client.getEnvironment.mockReturnValue("production");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Context", () => {
		it("should be ready with data", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			await context.ready();
			expect(context.isReady()).toEqual(true);
			expect(context.data()).toStrictEqual(getContextResponse);
			expect(context.eventLogger()).toBe(defaultEventLogger);
			expect(context.provider()).toBe(provider);
			expect(context.publisher()).toBe(publisher);
		});

		it("should use custom publisher, dataProvider and eventLogger", async () => {
			const customPublisher = { publish: vi.fn() } as unknown as ContextPublisher;
			const customDataProvider = { getContextData: vi.fn() } as unknown as ContextDataProvider;
			const customEventLogger = vi.fn();

			const context = new Context(
				sdk,
				{
					...contextOptions,
					publisher: customPublisher,
					dataProvider: customDataProvider,
					eventLogger: customEventLogger,
				},
				contextParams,
				getContextResponse as any
			);
			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			await context.ready();
			expect(context.isReady()).toEqual(true);
			expect(context.data()).toStrictEqual(getContextResponse);
			expect(context.eventLogger()).toBe(customEventLogger);
			expect(context.provider()).toBe(customDataProvider);
			expect(context.publisher()).toBe(customPublisher);
		});

		it("should become ready and call handler", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			await context.ready();
			expect(context.isReady()).toEqual(true);
			expect(context.data()).toStrictEqual(getContextResponse);
			expect(context.eventLogger()).toBe(defaultEventLogger);
			expect(context.provider()).toBe(provider);
			expect(context.publisher()).toBe(publisher);
		});

		it("should become ready and failed, and call handler on failure", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text") as any);
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			await context.ready();
			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(true);
			expect(context.data()).toStrictEqual({});
			expect(context.eventLogger()).toBe(defaultEventLogger);
			expect(context.provider()).toBe(provider);
			expect(context.publisher()).toBe(publisher);
		});

		it("should call event logger on error", async () => {
			defaultEventLogger.mockClear();

			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text") as any);
			await context.ready();
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "error", "bad request error text");
		});

		it("should call event logger on success", async () => {
			defaultEventLogger.mockClear();

			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));
			await context.ready();
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "ready", getContextResponse);
		});

		it("should call event logger on pre-fetched experiment data", async () => {
			defaultEventLogger.mockClear();

			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			await context.ready();
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "ready", getContextResponse);
		});

		it("should throw when not ready", () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			expect(() => context.data()).toThrow();
			expect(() => context.treatment("test")).toThrow();
			expect(() => context.peek("test")).toThrow();
			expect(() => context.experiments()).toThrow();
			expect(() => context.variableKeys()).toThrow();
			expect(() => context.variableValue("a", "17")).toThrow();
			expect(() => context.peekVariableValue("a", "17")).toThrow();
		});

		it("should load experiment data", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			expect(context.experiments()).toEqual(getContextResponse.experiments.map((x) => x.name));
			for (const experiment of getContextResponse.experiments) {
				expect(context.peek(experiment.name)).toEqual(expectedVariants[experiment.name]);
				expect(context.treatment(experiment.name)).toEqual(expectedVariants[experiment.name]);
			}
			expect(context.data()).toEqual(getContextResponse);
		});
	});

	describe("unit()", () => {
		it("should set a unit", () => {
			const context = new Context(sdk, contextOptions, { units: {} }, getContextResponse as any);

			context.units(units);

			for (const [key, value] of Object.entries(units)) {
				expect(context.getUnit(key)).toEqual(value);
			}

			expect(context.getUnits()).toEqual(units);
		});

		it("should throw on duplicate unit type set", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.isReady()).toEqual(true);

			expect(() => context.unit("session_id", "new_id")).toThrow();
			expect(() => context.unit("session_id", "e791e240fcd3df7d238cfc285f475e8152fcc0ec")).not.toThrow();
		});

		it("should throw on invalid uid", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.isReady()).toEqual(true);

			expect(() => context.unit("session_id", "")).toThrow();
			expect(() => context.unit("session_id", null as any)).toThrow();
			expect(() => context.unit("session_id", undefined as any)).toThrow();
			expect(() => context.unit("session_id", true as any)).toThrow();
			expect(() => context.unit("session_id", {} as any)).toThrow();
			expect(() => context.unit("session_id", [] as any)).toThrow();
		});

		it("should be callable before ready()", async () => {
			const context = new Context(sdk, contextOptions, { units: {} } as any, Promise.resolve(getContextResponse as any));

			context.units(contextParams.units);

			await context.ready();
			expect(context.isReady()).toEqual(true);

			context.treatment("exp_test_ab");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should throw after finalized() call", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.unit("test", "test")).toThrow();

			await finalizePromise;

			expect(() => context.unit("test", "test")).toThrow();
		});
	});

	describe("getAttribute()", () => {
		it("should get the last set attribute", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.attribute("attr1", "value1");
			context.attribute("attr1", "value2");

			expect(context.getAttribute("attr1")).toEqual("value2");
		});
	});

	describe("attribute()", () => {
		it("should set an attribute", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.attribute("attr1", "value1");
			context.attributes({
				attr2: "value2",
				attr3: 15,
			});

			expect(context.getAttribute("attr1")).toEqual("value1");
			expect(context.getAttributes()).toEqual({
				attr1: "value1",
				attr2: "value2",
				attr3: 15,
			});
		});

		it("should be callable before ready()", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			context.attribute("attr1", "value1");
			context.attributes({
				attr2: "value2",
				attr3: 3,
			});

			expect(context.getAttribute("attr1")).toEqual("value1");
			expect(context.getAttributes()).toEqual({
				attr1: "value1",
				attr2: "value2",
				attr3: 3,
			});

			await context.ready();
			expect(context.isReady()).toEqual(true);

			context.treatment("exp_test_ab");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
					attributes: [
						{ name: "attr1", setAt: 1611141535729, value: "value1" },
						{ name: "attr2", setAt: 1611141535729, value: "value2" },
						{ name: "attr3", setAt: 1611141535729, value: 3 },
					],
				},
				sdk,
				context,
				undefined
			);
		});
	});

	describe("refresh()", () => {
		it("should call client and load new data", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(refreshContextResponse));

			await context.refresh();
			expect(provider.getContextData).toHaveBeenCalledTimes(1);
			expect(provider.getContextData).toHaveBeenCalledWith(sdk, undefined);

			expect(context.experiments()).toEqual(refreshContextResponse.experiments.map((x) => x.name));
			for (const experiment of refreshContextResponse.experiments) {
				expect(context.treatment(experiment.name)).toEqual(expectedVariants[experiment.name]);
			}
			expect(context.data()).toEqual(refreshContextResponse);
		});

		it("should pass through request options", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(refreshContextResponse));

			await context.refresh({ timeout: 1234 } as any);
			expect(provider.getContextData).toHaveBeenCalledTimes(1);
			expect(provider.getContextData).toHaveBeenCalledWith(sdk, { timeout: 1234 });

			expect(context.experiments()).toEqual(refreshContextResponse.experiments.map((x) => x.name));
			for (const experiment of refreshContextResponse.experiments) {
				expect(context.treatment(experiment.name)).toEqual(expectedVariants[experiment.name]);
			}
			expect(context.data()).toEqual(refreshContextResponse);
		});

		it("should reject promise on error", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValueOnce(Promise.reject(new Error("test error")));

			await expect(context.refresh()).rejects.toThrow("test error");
		});

		it("should not re-queue exposures after refresh when not changed", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(refreshContextResponse));

			await context.refresh();
			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			expect(provider.getContextData).toHaveBeenCalledTimes(1);
			expect(provider.getContextData).toHaveBeenCalledWith(sdk, undefined);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			for (const experiment of refreshContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(refreshContextResponse.experiments.length);
		});

		it("should not re-queue when not changed on audience mismatch", async () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);

			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(1);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(audienceStrictContextResponse));

			await context.refresh();
			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(1);
		});

		it("should not re-queue when not changed with override", async () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);

			context.override("exp_test_ab", 3);
			expect(context.treatment("exp_test_ab")).toEqual(3);
			expect(context.pending()).toEqual(1);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(audienceStrictContextResponse));

			await context.refresh();
			expect(context.treatment("exp_test_ab")).toEqual(3);
			expect(context.pending()).toEqual(1);
		});

		it("should not call client publish when failed", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text") as any);

			await context.ready();
			await context.refresh();
			expect(provider.getContextData).not.toHaveBeenCalled();
		});

		it("should call event logger when failed", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));
			await context.ready();
			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValueOnce(Promise.reject(new Error("test error")));

			defaultEventLogger.mockClear();
			await expect(context.refresh()).rejects.toThrow("test error");
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "error", expect.any(Error));
		});

		it("should call event logger on success", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValueOnce(Promise.resolve(refreshContextResponse));

			await context.ready();
			defaultEventLogger.mockClear();
			await context.refresh();
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "refresh", refreshContextResponse);
		});

		it("should throw after finalized() call", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.refresh()).toThrow();

			await finalizePromise;

			expect(() => context.refresh()).toThrow();
		});

		it("should keep overrides", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(refreshContextResponse));

			context.override("not_found", 3);
			expect(context.peek("not_found")).toEqual(3);

			await context.refresh();
			expect(context.peek("not_found")).toEqual(3);
		});

		it("should keep custom assignments", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(refreshContextResponse));

			context.customAssignment("exp_test_ab", 3);
			expect(context.peek("exp_test_ab")).toEqual(3);

			await context.refresh();
			expect(context.peek("exp_test_ab")).toEqual(3);
		});

		it("should pick up changes in experiment stopped", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			const experimentName = "exp_test_abc";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const stoppedRefreshContextResponse = clone(getContextResponse);
			stoppedRefreshContextResponse.experiments = stoppedRefreshContextResponse.experiments.filter(
				(x) => x.name !== experimentName
			);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(stoppedRefreshContextResponse));

			await context.refresh();
			expect(context.treatment(experimentName)).toEqual(0);
			expect(context.pending()).toEqual(2);
		});

		it("should pick up changes in experiment started", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			const experimentName = "exp_test_new";

			expect(context.treatment(experimentName)).toEqual(0);
			expect(context.pending()).toEqual(1);

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(refreshContextResponse));

			await context.refresh();
			expect(context.treatment(experimentName)).toEqual(1);
			expect(context.pending()).toEqual(2);
		});

		it("should pick up changes in experiment fullon", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			const experimentName = "exp_test_abc";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const fullOnRefreshContextResponse = clone(getContextResponse);
			for (const experiment of fullOnRefreshContextResponse.experiments) {
				if (experiment.name === experimentName) {
					expect(experiment.fullOnVariant).toEqual(0);
					experiment.fullOnVariant = 1;
					expect(expectedVariants[experimentName]).not.toEqual(experiment.fullOnVariant);
				}
			}

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(fullOnRefreshContextResponse));

			await context.refresh();
			expect(context.treatment(experimentName)).toEqual(1);
			expect(context.pending()).toEqual(2);
		});

		it("should pick up changes in experiment traffic split", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			const experimentName = "exp_test_not_eligible";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const scaledUpRefreshContextResponse = clone(getContextResponse);
			for (const experiment of scaledUpRefreshContextResponse.experiments) {
				if (experiment.name === experimentName) {
					experiment.trafficSplit = [0.0, 1.0];
				}
			}

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(scaledUpRefreshContextResponse));

			await context.refresh();
			expect(context.treatment(experimentName)).toEqual(2);
			expect(context.pending()).toEqual(2);
		});

		it("should pick up changes in experiment iteration", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			const experimentName = "exp_test_abc";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const iteratedRefreshContextResponse = clone(getContextResponse);
			for (const experiment of iteratedRefreshContextResponse.experiments) {
				if (experiment.name === experimentName) {
					experiment.iteration = 2;
					experiment.trafficSeedHi = 398724581;
					experiment.seedHi = 34737352;
				}
			}

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(iteratedRefreshContextResponse));

			await context.refresh();
			expect(context.treatment(experimentName)).toEqual(1);
			expect(context.pending()).toEqual(2);
		});

		it("should pick up changes in experiment id", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			const experimentName = "exp_test_abc";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const iteratedRefreshContextResponse = clone(getContextResponse);
			for (const experiment of iteratedRefreshContextResponse.experiments) {
				if (experiment.name === experimentName) {
					experiment.id = 11;
					experiment.trafficSeedHi = 398724581;
					experiment.seedHi = 34737352;
				}
			}

			(provider.getContextData as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve(iteratedRefreshContextResponse));

			await context.refresh();
			expect(context.treatment(experimentName)).toEqual(1);
			expect(context.pending()).toEqual(2);
		});
	});

	describe("peek()", () => {
		it("should not queue exposures", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				expect(context.peek(experiment.name)).toEqual(expectedVariants[experiment.name]);
			}

			expect(context.pending()).toEqual(0);
		});

		it("should return override variant", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				context.override(experiment.name, expectedVariants[experiment.name] + 11);
			}
			context.override("not_found", 3);

			for (const experiment of getContextResponse.experiments) {
				expect(context.peek(experiment.name)).toEqual(expectedVariants[experiment.name] + 11);
			}

			expect(context.peek("not_found")).toEqual(3);
			expect(context.pending()).toEqual(0);
		});

		it("should return assigned variant on audience mismatch in non-strict mode", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse as any);
			expect(context.peek("exp_test_ab")).toEqual(1);
		});

		it("should return control variant on audience mismatch in strict mode", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);
			expect(context.peek("exp_test_ab")).toEqual(0);
		});

		it("should re-evaluate audience expression when attributes change in strict mode", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);

			expect(context.peek("exp_test_ab")).toEqual(0);

			context.attribute("age", 25);

			expect(context.peek("exp_test_ab")).toEqual(1);
			expect(context.pending()).toEqual(0);
		});

		it("should re-evaluate audience expression when attributes change in non-strict mode", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse as any);

			expect(context.peek("exp_test_ab")).toEqual(1);

			context.attribute("age", 25);

			expect(context.peek("exp_test_ab")).toEqual(1);
			expect(context.pending()).toEqual(0);
		});

		it("should not re-evaluate audience when no new attributes set", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);

			context.attribute("age", 15);

			expect(context.peek("exp_test_ab")).toEqual(0);
			expect(context.peek("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(0);
		});
	});

	describe("treatment()", () => {
		it("should queue exposures", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_ab",
							overridden: false,
							unit: "session_id",
							variant: 1,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 2,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_abc",
							overridden: false,
							unit: "session_id",
							variant: 2,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 3,
							assigned: true,
							eligible: false,
							exposedAt: 1611141535729,
							name: "exp_test_not_eligible",
							overridden: false,
							unit: "user_id",
							variant: 0,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 4,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_fullon",
							overridden: false,
							unit: "session_id",
							variant: 2,
							fullOn: true,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 5,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_custom_fields",
							overridden: false,
							unit: "session_id",
							variant: 1,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should queue exposures only once", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);
		});

		it("should call event logger", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			for (const experiment of getContextResponse.experiments) {
				defaultEventLogger.mockClear();
				context.treatment(experiment.name);
				expect(defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(defaultEventLogger).toHaveBeenCalledWith(context, "exposure", {
					exposedAt: timeOrigin,
					eligible: experiment.name !== "exp_test_not_eligible",
					assigned: true,
					overridden: false,
					id: experiment.id,
					name: experiment.name,
					unit: experiment.unitType,
					variant: expectedVariants[experiment.name],
					fullOn: experiment.name === "exp_test_fullon",
					custom: false,
					audienceMismatch: false,
				});
			}

			for (const experiment of getContextResponse.experiments) {
				defaultEventLogger.mockClear();
				context.treatment(experiment.name);
				expect(defaultEventLogger).not.toHaveBeenCalled();
			}
		});

		it("should queue exposure with base variant on unknown/stopped experiment", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(context.treatment("not_found")).toEqual(0);
			expect(context.pending()).toEqual(1);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 0,
							assigned: false,
							eligible: true,
							exposedAt: 1611141535729,
							name: "not_found",
							overridden: false,
							unit: null,
							variant: 0,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should queue exposure with audienceMatch true on audience match", async () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse as any);
			context.attribute("age", 21);

			expect(context.treatment("exp_test_ab")).toEqual(1);
			expect(context.pending()).toEqual(1);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					attributes: [{ name: "age", setAt: 1611141535729, value: 21 }],
					exposures: [
						{
							id: 1,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_ab",
							overridden: false,
							unit: "session_id",
							variant: 1,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should queue exposure with audienceMatch false on audience mismatch", async () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse as any);

			expect(context.treatment("exp_test_ab")).toEqual(1);
			expect(context.pending()).toEqual(1);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_ab",
							overridden: false,
							unit: "session_id",
							variant: 1,
							fullOn: false,
							custom: false,
							audienceMismatch: true,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should queue exposure with audienceMatch false and control variant on audience mismatch in strict mode", async () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);

			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(1);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							assigned: false,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_ab",
							overridden: false,
							unit: "session_id",
							variant: 0,
							fullOn: false,
							custom: false,
							audienceMismatch: true,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should not re-queue exposure on unknown experiment", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			expect(context.pending()).toEqual(0);
			expect(context.treatment("not_found")).toEqual(0);
			expect(context.pending()).toEqual(1);
			expect(context.treatment("not_found")).toEqual(0);
			expect(context.pending()).toEqual(1);
		});

		it("should queue exposure with override variant", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			context.override("exp_test_ab", 5);
			context.override("not_found", 3);

			expect(context.treatment("exp_test_ab")).toEqual(5);
			expect(context.treatment("not_found")).toEqual(3);

			expect(context.pending()).toEqual(2);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							assigned: false,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_ab",
							overridden: true,
							unit: "session_id",
							variant: 5,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 0,
							assigned: false,
							eligible: true,
							exposedAt: 1611141535729,
							name: "not_found",
							overridden: true,
							unit: null,
							variant: 3,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should throw after finalized() call", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.treatment("exp_test_ab")).toThrow();

			await finalizePromise;

			expect(() => context.treatment("exp_test_ab")).toThrow();
		});

		it("should re-evaluate audience expression when attributes change in strict mode", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);

			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(1);

			context.attribute("age", 25);

			expect(context.treatment("exp_test_ab")).toEqual(1);
			expect(context.pending()).toEqual(2);
		});

		it("should re-evaluate audience expression when attributes change in non-strict mode", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse as any);

			expect(context.treatment("exp_test_ab")).toEqual(1);
			expect(context.pending()).toEqual(1);

			context.attribute("age", 25);

			expect(context.treatment("exp_test_ab")).toEqual(1);
			expect(context.pending()).toEqual(2);
		});

		it("should not re-evaluate audience when no new attributes set", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);

			context.attribute("age", 15);

			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(1);

			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(1);
		});

		it("should not invalidate cache when audience result unchanged after attribute change", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);

			context.attribute("age", 15);

			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(1);

			context.attribute("age", 18);

			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context.pending()).toEqual(1);
		});
	});

	describe("variableValue()", () => {
		it("should not return variable values when unassigned", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);
			expect(context.pending()).toEqual(0);
			expect(context.variableValue("banner.size", "17")).toEqual("17");
		});

		it("should return variable values when overridden", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);
			expect(context.pending()).toEqual(0);
			context.override("exp_test_ab", 0);
			expect(context.variableValue("banner.size", "17")).toEqual("tiny");
		});

		it("conflicting key disjoint audiences", () => {
			const context1 = new Context(sdk, contextOptions, contextParams, disjointedContextResponse as any);
			const context2 = new Context(sdk, contextOptions, contextParams, disjointedContextResponse as any);

			expect(context1.pending()).toEqual(0);
			expect(context2.pending()).toEqual(0);

			expect(expectedVariants["exp_test_ab"]).not.toEqual(0);
			expect(expectedVariants["exp_test_abc"]).not.toEqual(0);

			context1.attribute("age", 20);
			expect(context1.variableValue("icon", "square")).toEqual("arrow");

			context2.attribute("age", 19);
			expect(context2.variableValue("icon", "square")).toEqual("circle");
		});

		it("should queue exposures", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			const experiments = context.experiments()!;

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				const actual = context.variableValue(key, "17");
				const eligible = experimentName !== "exp_test_not_eligible";

				if (eligible && experiments.indexOf(experimentName) !== -1) {
					expect(actual).toEqual(expectedVariables[key]);
				} else {
					expect(actual).toBe("17");
				}
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_ab",
							overridden: false,
							unit: "session_id",
							variant: 1,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 2,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_abc",
							overridden: false,
							unit: "session_id",
							variant: 2,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 3,
							assigned: true,
							eligible: false,
							exposedAt: 1611141535729,
							name: "exp_test_not_eligible",
							overridden: false,
							unit: "user_id",
							variant: 0,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 4,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_fullon",
							overridden: false,
							unit: "session_id",
							variant: 2,
							fullOn: true,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 5,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_custom_fields",
							overridden: false,
							unit: "session_id",
							variant: 1,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should return defaultValue on unknown variable", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);
			expect(context.variableValue("not.found", "17")).toBe("17");
		});
	});

	describe("peekVariableValue()", () => {
		it("should not return variable values when unassigned", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);
			expect(context.pending()).toEqual(0);
			expect(context.peekVariableValue("banner.size", "17")).toEqual("17");
		});

		it("should return variable values when overridden", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse as any);
			expect(context.pending()).toEqual(0);
			context.override("exp_test_ab", 0);
			expect(context.peekVariableValue("banner.size", "17")).toEqual("tiny");
		});

		it("conflicting key disjoint audiences", () => {
			const context1 = new Context(sdk, contextOptions, contextParams, disjointedContextResponse as any);
			const context2 = new Context(sdk, contextOptions, contextParams, disjointedContextResponse as any);

			expect(context1.pending()).toEqual(0);
			expect(context2.pending()).toEqual(0);

			context1.attribute("age", 20);
			expect(context1.peekVariableValue("icon", "square")).toEqual("arrow");

			context2.attribute("age", 19);
			expect(context2.peekVariableValue("icon", "square")).toEqual("circle");

			expect(context1.pending()).toEqual(0);
			expect(context2.pending()).toEqual(0);
		});

		it("should pick lowest experiment id on conflicting key", () => {
			const context = new Context(sdk, contextOptions, contextParams, lowestIdConflictingKeyContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(expectedVariants["exp_test_ab"]).not.toEqual(0);
			expect(expectedVariants["exp_test_abc"]).not.toEqual(0);

			expect(context.peekVariableValue("icon", "square")).toEqual("circle");
		});

		it("should not queue exposures", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			const experiments = context.experiments()!;

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				const actual = context.peekVariableValue(key, "17");
				const eligible = experimentName !== "exp_test_not_eligible";

				if (eligible && experiments.indexOf(experimentName) !== -1) {
					expect(actual).toEqual(expectedVariables[key]);
				} else {
					expect(actual).toBe("17");
				}
			}

			expect(context.pending()).toEqual(0);
		});
	});

	describe("variableKeys()", () => {
		it("should return all active keys", () => {
			const context = new Context(sdk, contextOptions, contextParams, refreshContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(context.variableKeys()).toMatchObject(variableExperiments);
			expect(context.pending()).toEqual(0);
		});
	});

	describe("track()", () => {
		it("should queue goals", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			context.track("goal1", { amount: 125, hours: 245 });
			context.track("goal2", { tries: 7 });

			expect(context.pending()).toEqual(2);

			context.track("goal2", { tests: 12 });

			expect(context.pending()).toEqual(3);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					goals: [
						{ achievedAt: 1611141535729, name: "goal1", properties: { amount: 125, hours: 245 } },
						{ achievedAt: 1611141535729, name: "goal2", properties: { tries: 7 } },
						{ achievedAt: 1611141535729, name: "goal2", properties: { tests: 12 } },
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should call event logger", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			defaultEventLogger.mockClear();
			context.track("goal1", { amount: 125, hours: 245 });
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "goal", {
				achievedAt: timeOrigin,
				name: "goal1",
				properties: { amount: 125, hours: 245 },
			});
		});

		it("should not throw when goal property values are numbers or objects with number values", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(() => context.track("goal1", { test: { flt: 1.5, int: 2 } })).not.toThrowError();
			expect(() => context.track("goal1", { test: {} })).not.toThrowError();
			expect(() => context.track("goal1", { test: null })).not.toThrowError();

			expect(context.pending()).toEqual(3);
		});

		it("should not throw when goal properties is null or undefined", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(() => context.track("goal1")).not.toThrowError();
			expect(() => context.track("goal1", null as any)).not.toThrowError();
			expect(() => context.track("goal1", undefined)).not.toThrowError();

			expect(context.pending()).toEqual(3);
		});

		it("should throw when goal properties not object", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(() => context.track("goal1", 125.0 as any)).toThrowError("Goal 'goal1' properties must be of type object.");
			expect(() => context.track("goal1", true as any)).toThrowError("Goal 'goal1' properties must be of type object.");
			expect(() => context.track("goal1", "testy" as any)).toThrowError("Goal 'goal1' properties must be of type object.");
			expect(() => context.track("goal1", [] as any)).toThrowError("Goal 'goal1' properties must be of type object.");
		});

		it("should throw after finalized() call", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.track("payment", { amount: 125 })).toThrow();

			await finalizePromise;

			expect(() => context.track("payment", { amount: 125 })).toThrow();
		});

		it("should queue when not ready", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));
			expect(context.pending()).toEqual(0);
			expect(context.isReady()).toEqual(false);

			context.track("goal1", { amount: 125 });

			expect(context.pending()).toEqual(1);
			expect(context.isReady()).toEqual(false);

			await context.ready();
			expect(context.pending()).toEqual(1);
		});
	});

	describe("publish()", () => {
		it("should not call client publish when queue is empty", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).not.toHaveBeenCalled();
		});

		it("should propagate client error message", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			context.track("goal1", { amount: 125 });

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.reject("test"));

			await expect(context.publish()).rejects.toEqual("test");
		});

		it("should call client publish", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.treatment("exp_test_ab");
			context.treatment("exp_test_not_eligible");

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 1);
			context.track("goal1", { amount: 125, hours: 245 });

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 2);
			context.attribute("attr1", "value1");

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 3);
			context.attributes({
				attr2: "value2",
				attr3: 3,
				attr4: 5.0,
				attr5: true,
				attr6: [1, 2, 3, 4],
				attr7: null,
				attr8: [],
				attr9: [null, 1, 2],
				attr10: ["one", null, "two"],
				attr11: [null, null],
			});

			expect(context.pending()).toEqual(3);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 3,
							name: "exp_test_not_eligible",
							unit: "user_id",
							exposedAt: 1611141535729,
							variant: 0,
							assigned: true,
							eligible: false,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
					goals: [
						{
							name: "goal1",
							achievedAt: 1611141535730,
							properties: { amount: 125, hours: 245 },
						},
					],
					attributes: [
						{ name: "attr1", setAt: 1611141535731, value: "value1" },
						{ name: "attr2", setAt: 1611141535732, value: "value2" },
						{ name: "attr3", setAt: 1611141535732, value: 3 },
						{ name: "attr4", setAt: 1611141535732, value: 5.0 },
						{ name: "attr5", setAt: 1611141535732, value: true },
						{ name: "attr6", setAt: 1611141535732, value: [1, 2, 3, 4] },
						{ name: "attr7", setAt: 1611141535732, value: null },
						{ name: "attr8", setAt: 1611141535732, value: [] },
						{ name: "attr9", setAt: 1611141535732, value: [null, 1, 2] },
						{ name: "attr10", setAt: 1611141535732, value: ["one", null, "two"] },
						{ name: "attr11", setAt: 1611141535732, value: [null, null] },
					],
				},
				sdk,
				context,
				undefined
			);

			expect(context.pending()).toEqual(0);
		});

		it("should pass through request options", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.track("goal1", { amount: 125, hours: 245 });

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			await context.publish({ timeout: 1234 } as any);
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					goals: [
						{
							name: "goal1",
							achievedAt: 1611141535729,
							properties: { amount: 125, hours: 245 },
						},
					],
				},
				sdk,
				context,
				{ timeout: 1234 }
			);

			expect(context.pending()).toEqual(0);
		});

		it("should call event logger on error", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.track("goal1", { amount: 125, hours: 245 });

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.reject("test error"));

			defaultEventLogger.mockClear();
			await expect(context.publish()).rejects.toEqual("test error");
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "error", "test error");
		});

		it("should call event logger on success", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.track("goal1", { amount: 125, hours: 245 });

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			defaultEventLogger.mockClear();
			await context.publish();
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "publish", {
				publishedAt: 1611141535829,
				units: publishUnits,
				hashed: true,
				sdkVersion: SDK_VERSION,
				goals: [
					{
						achievedAt: 1611141535729,
						name: "goal1",
						properties: { amount: 125, hours: 245 },
					},
				],
			});
		});

		it("should not call client publish when failed", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text") as any);
			await context.ready();
			context.treatment("exp_test_ab");

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 1);
			context.track("goal1", { amount: 125, hours: 245 });

			expect(context.pending()).toEqual(2);

			await context.publish();
			expect(publisher.publish).not.toHaveBeenCalled();
			expect(context.pending()).toEqual(0);
		});

		it("should reset internal queues and keep attributes overrides and custom assignments", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.treatment("exp_test_ab");
			context.track("goal1", { amount: 125, hours: 245 });
			context.attribute("attr1", "value1");

			context.override("not_found", 3);
			expect(context.treatment("not_found")).toEqual(3);

			context.customAssignment("exp_test_abc", 3);
			expect(context.treatment("exp_test_abc")).toEqual(3);

			expect(context.pending()).toEqual(4);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve({}));

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 0,
							name: "not_found",
							unit: null,
							exposedAt: 1611141535729,
							variant: 3,
							assigned: false,
							eligible: true,
							overridden: true,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 2,
							name: "exp_test_abc",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 3,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: true,
							audienceMismatch: false,
						},
					],
					goals: [
						{
							name: "goal1",
							achievedAt: 1611141535729,
							properties: { amount: 125, hours: 245 },
						},
					],
					attributes: [
						{ name: "attr1", setAt: 1611141535729, value: "value1" },
					],
				},
				sdk,
				context,
				undefined
			);

			expect(context.pending()).toEqual(0);

			(publisher.publish as ReturnType<typeof vi.fn>).mockClear();

			context.track("goal2", { test: 999 });

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					goals: [
						{
							name: "goal2",
							achievedAt: 1611141535829,
							properties: { test: 999 },
						},
					],
					attributes: [
						{ name: "attr1", setAt: 1611141535729, value: "value1" },
					],
				},
				sdk,
				context,
				undefined
			);

			expect(context.pending()).toEqual(0);

			expect(context.treatment("exp_test_abc")).toEqual(3);
			expect(context.treatment("not_found")).toEqual(3);

			expect(context.pending()).toEqual(0);
		});

		it("should throw after finalized() call", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.publish()).toThrow();

			await finalizePromise;

			expect(() => context.publish()).toThrow();
		});
	});

	describe("finalize()", () => {
		it("should not call client publish when queue is empty", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			expect(context.isFinalizing()).toEqual(false);

			await context.finalize();
			expect(publisher.publish).not.toHaveBeenCalled();
			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);
		});

		it("should propagate client error message", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			context.treatment("exp_test_ab");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.reject("test"));

			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);

			await expect(finalizePromise).rejects.toEqual("test");
			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);
		});

		it("should call client publish", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);

			await finalizePromise;
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);

			expect(context.pending()).toEqual(0);
			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);
		});

		it("should pass through request options", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			const finalizePromise = context.finalize({ timeout: 1234 } as any);

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);

			await finalizePromise;
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				{ timeout: 1234 }
			);

			expect(context.pending()).toEqual(0);
			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);
		});

		it("should call event logger on error", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.treatment("exp_test_ab");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.reject("test error"));

			defaultEventLogger.mockClear();
			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);

			await expect(finalizePromise).rejects.toEqual("test error");
			expect(defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(defaultEventLogger).toHaveBeenCalledWith(context, "error", "test error");
			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);
		});

		it("should call event logger on success", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.treatment("exp_test_ab");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			defaultEventLogger.mockClear();
			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);

			await finalizePromise;
			expect(defaultEventLogger).toHaveBeenCalledTimes(2);
			expect(defaultEventLogger).toHaveBeenLastCalledWith(context, "finalize", undefined);
			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);
		});

		it("should not call client publish when failed", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text") as any);
			await context.ready();
			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			expect(context.isFinalizing()).toEqual(false);

			await context.finalize();
			expect(publisher.publish).not.toHaveBeenCalled();
			expect(context.pending()).toEqual(0);
			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);
		});

		it("should return current promise when called twice", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.treatment("exp_test_ab");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			const firstPromise = context.finalize();
			const secondPromise = context.finalize();

			expect(secondPromise).toBe(firstPromise);

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);

			await secondPromise;

			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);
		});

		it("should return completed promise when already finalized", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);

			context.treatment("exp_test_ab");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.finalize();
			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);

			await context.finalize();
		});
	});

	describe("override()", () => {
		it("should be callable before ready()", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			context.override("exp_test_ab", 1);
			context.overrides({
				exp_test_ab: 2,
				exp_test_abc: 2,
				not_found: 3,
			});

			await context.ready();
			expect(context.isReady()).toEqual(true);
			expect(context.data()).toStrictEqual(getContextResponse);

			context.treatment("exp_test_ab");
			context.treatment("exp_test_abc");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 2,
							assigned: false,
							eligible: true,
							overridden: true,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 2,
							name: "exp_test_abc",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 2,
							assigned: false,
							eligible: true,
							overridden: true,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});
	});

	describe("customAssignment()", () => {
		it("should override natural assignment and set custom flag", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			context.customAssignment("exp_test_abc", 11);

			expect(context.pending()).toEqual(0);

			context.treatment("exp_test_abc");

			expect(context.pending()).toEqual(1);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 2,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_abc",
							overridden: false,
							unit: "session_id",
							variant: 11,
							fullOn: false,
							custom: true,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should not override full-on or non-eligible assignment", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			context.customAssignment("exp_test_not_eligible", 11);
			context.customAssignment("exp_test_fullon", 11);

			expect(context.pending()).toEqual(0);

			context.treatment("exp_test_not_eligible");
			context.treatment("exp_test_fullon");

			expect(context.pending()).toEqual(2);

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535729,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 3,
							assigned: true,
							eligible: false,
							exposedAt: 1611141535729,
							name: "exp_test_not_eligible",
							overridden: false,
							unit: "user_id",
							variant: 0,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
						},
						{
							id: 4,
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_fullon",
							overridden: false,
							unit: "session_id",
							variant: 2,
							fullOn: true,
							custom: false,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should be callable before ready()", async () => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse as any));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			context.customAssignment("exp_test_ab", 1);
			context.customAssignments({
				exp_test_ab: 2,
				exp_test_abc: 2,
				not_found: 3,
			});

			await context.ready();
			expect(context.isReady()).toEqual(true);
			expect(context.data()).toStrictEqual(getContextResponse);

			context.treatment("exp_test_ab");
			context.treatment("exp_test_abc");

			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			vi.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			await context.publish();
			expect(publisher.publish).toHaveBeenCalledTimes(1);
			expect(publisher.publish).toHaveBeenCalledWith(
				{
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					sdkVersion: SDK_VERSION,
					exposures: [
						{
							id: 1,
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 2,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: true,
							audienceMismatch: false,
						},
						{
							id: 2,
							name: "exp_test_abc",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 2,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: true,
							audienceMismatch: false,
						},
					],
				},
				sdk,
				context,
				undefined
			);
		});

		it("should throw after finalized() call", async () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			const finalizePromise = context.finalize();

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.customAssignment("exp_test_ab", 3)).toThrow();

			await finalizePromise;

			expect(() => context.customAssignment("exp_test_ab", 3)).toThrow();
		});
	});

	describe("customFieldKeys()", () => {
		it("should return custom field keys", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);
			const keys = context.customFieldKeys();

			expect(context.isReady()).toEqual(true);
			expect(keys).toEqual([
				"country",
				"json_object",
				"json_array",
				"json_number",
				"json_string",
				"json_boolean",
				"json_null",
				"json_invalid",
				"languages",
				"text_field",
				"string_field",
				"number_field",
				"boolean_field",
				"false_boolean_field",
				"invalid_type_field",
			]);
		});
	});

	describe("customFieldValue()", () => {
		it("should return custom field value", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);
			const value = context.customFieldValue("exp_test_custom_fields", "country");

			expect(context.isReady()).toEqual(true);
			expect(value).toEqual("US,PT,ES");
		});

		it("should return parsed JSON fields", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(context.customFieldValue("exp_test_abc", "json_object")).toEqual({ 123: 1, 456: 0 });
			expect(context.customFieldValue("exp_test_abc", "json_array")).toEqual(["hello", "world"]);
			expect(context.customFieldValue("exp_test_abc", "json_number")).toEqual(123);
			expect(context.customFieldValue("exp_test_abc", "json_string")).toEqual("hello");
			expect(context.customFieldValue("exp_test_abc", "json_boolean")).toEqual(true);
			expect(context.customFieldValue("exp_test_abc", "json_null")).toEqual(null);
		});

		it("should return string and text fields", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(context.customFieldValue("exp_test_custom_fields", "text_field")).toEqual("hello text");
			expect(context.customFieldValue("exp_test_custom_fields", "string_field")).toEqual("hello string");
		});

		it("should return parsed number fields", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(context.customFieldValue("exp_test_custom_fields", "number_field")).toEqual(123);
		});

		it("should return parsed boolean fields", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(context.customFieldValue("exp_test_custom_fields", "boolean_field")).toEqual(true);
			expect(context.customFieldValue("exp_test_custom_fields", "false_boolean_field")).toEqual(false);
		});

		it("should console an error when JSON cannot be parsed", () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(context.customFieldValue("exp_test_abc", "json_invalid")).toEqual(null);
			expect(errorSpy).toHaveBeenCalledTimes(1);
			expect(errorSpy).toHaveBeenCalledWith(
				"Failed to parse JSON custom field value 'json_invalid' for experiment 'exp_test_abc'"
			);
			errorSpy.mockRestore();
		});

		it("should console an error when a field type is invalid", () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);

			expect(context.customFieldValue("exp_test_custom_fields", "invalid_type_field")).toEqual(null);
			expect(errorSpy).toHaveBeenCalledTimes(1);
			expect(errorSpy).toHaveBeenCalledWith(
				"Unknown custom field type 'invalid' for experiment 'exp_test_custom_fields' and key 'invalid_type_field' - you may need to upgrade to the latest SDK version"
			);
			errorSpy.mockRestore();
		});
	});

	describe("customFieldValueType()", () => {
		it("should return custom field value type", () => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse as any);
			expect(context.pending()).toEqual(0);
			const value = context.customFieldValueType("exp_test_custom_fields", "country");

			expect(context.isReady()).toEqual(true);
			expect(value).toEqual("string");
		});
	});

	describe("includeSystemAttributes", () => {
		it("should not include system attributes by default", async () => {
			const defaultOptions = { publishDelay: -1, refreshPeriod: 0 };

			const context = new Context(sdk, defaultOptions, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			await context.publish();
			const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls[0];
			const request = call[0];

			expect(request.attributes).toBeUndefined();
		});

		it("should include system attributes when includeSystemAttributes is true", async () => {
			const optionsWithSystemAttrs = {
				publishDelay: -1,
				refreshPeriod: 0,
				includeSystemAttributes: true,
			};

			const context = new Context(sdk, optionsWithSystemAttrs, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			await context.publish();
			const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls[0];
			const request = call[0];

			expect(request.attributes).toBeDefined();
			expect(request.attributes.length).toBeGreaterThanOrEqual(4);

			const sdkNameAttr = request.attributes.find((a: any) => a.name === "sdk_name");
			const sdkVersionAttr = request.attributes.find((a: any) => a.name === "sdk_version");
			const applicationAttr = request.attributes.find((a: any) => a.name === "application");
			const environmentAttr = request.attributes.find((a: any) => a.name === "environment");

			expect(sdkNameAttr).toBeDefined();
			expect(sdkNameAttr.value).toEqual("absmartly-javascript-sdk");
			expect(sdkNameAttr.setAt).toEqual(expect.any(Number));

			expect(sdkVersionAttr).toBeDefined();
			expect(sdkVersionAttr.value).toEqual(SDK_VERSION);
			expect(sdkVersionAttr.setAt).toEqual(expect.any(Number));

			expect(applicationAttr).toBeDefined();
			expect(applicationAttr.value).toEqual("website");
			expect(applicationAttr.setAt).toEqual(expect.any(Number));

			expect(environmentAttr).toBeDefined();
			expect(environmentAttr.value).toEqual("production");
			expect(environmentAttr.setAt).toEqual(expect.any(Number));
		});

		it("should prepend system attributes before user attributes", async () => {
			const optionsWithSystemAttrs = {
				publishDelay: -1,
				refreshPeriod: 0,
				includeSystemAttributes: true,
			};

			const context = new Context(sdk, optionsWithSystemAttrs, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.attribute("custom_attr", "custom_value");
			context.treatment("exp_test_ab");

			await context.publish();
			const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls[0];
			const request = call[0];

			expect(request.attributes[0].name).toEqual("sdk_name");
			expect(request.attributes[1].name).toEqual("sdk_version");
			expect(request.attributes[2].name).toEqual("application");
			expect(request.attributes[3].name).toEqual("environment");
			expect(request.attributes[4].name).toEqual("custom_attr");
			expect(request.attributes[4].value).toEqual("custom_value");
		});

		it("should include app_version when application version is set", async () => {
			client.getApplication.mockReturnValueOnce({ name: "website", version: 3 });

			const optionsWithSystemAttrs = {
				publishDelay: -1,
				refreshPeriod: 0,
				includeSystemAttributes: true,
			};

			const context = new Context(sdk, optionsWithSystemAttrs, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			await context.publish();
			const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls[0];
			const request = call[0];

			const appVersionAttr = request.attributes.find((a: any) => a.name === "app_version");
			expect(appVersionAttr).toBeDefined();
			expect(appVersionAttr.value).toEqual(3);
		});

		it("should not include app_version when application version is 0", async () => {
			const optionsWithSystemAttrs = {
				publishDelay: -1,
				refreshPeriod: 0,
				includeSystemAttributes: true,
			};

			const context = new Context(sdk, optionsWithSystemAttrs, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			await context.publish();
			const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls[0];
			const request = call[0];

			const appVersionAttr = request.attributes.find((a: any) => a.name === "app_version");
			expect(appVersionAttr).toBeUndefined();
		});

		it("should include app_version when application version is a semver string", async () => {
			client.getApplication.mockReturnValueOnce({ name: "website", version: "1.2.3" });

			const optionsWithSystemAttrs = {
				publishDelay: -1,
				refreshPeriod: 0,
				includeSystemAttributes: true,
			};

			const context = new Context(sdk, optionsWithSystemAttrs, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			await context.publish();
			const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls[0];
			const request = call[0];

			const appVersionAttr = request.attributes.find((a: any) => a.name === "app_version");
			expect(appVersionAttr).toBeDefined();
			expect(appVersionAttr.value).toEqual("1.2.3");
		});

		it("should only include user attributes when includeSystemAttributes is not set", async () => {
			const defaultOptions = { publishDelay: -1, refreshPeriod: 0 };

			const context = new Context(sdk, defaultOptions, contextParams, getContextResponse as any);
			(publisher.publish as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());

			context.attribute("custom_attr", "custom_value");
			context.treatment("exp_test_ab");

			await context.publish();
			const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls[0];
			const request = call[0];

			expect(request.attributes).toEqual([
				{ name: "custom_attr", value: "custom_value", setAt: expect.any(Number) },
			]);
		});
	});
});
