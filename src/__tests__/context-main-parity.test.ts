// Assignment rules, split rules, holdouts and publish()/finalize() behaviour. Cross-SDK scenario
// numbers in the test names match the shared scenario list.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Context } from "../context";
import { SDK } from "../sdk";
import { hashUnit } from "../hashing";

const jest = vi;

function clone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj)) as T;
}

function withDone(fn: (done: (err?: unknown) => void) => void) {
	return () =>
		new Promise<void>((resolve, reject) => {
			const done = (err?: unknown) => (err ? reject(err) : resolve());
			try {
				fn(done);
			} catch (e) {
				reject(e);
			}
		});
}

const originalIt = it;
const doneIt = Object.assign(
	(name: string, fn: (...args: any[]) => any, timeout?: number) =>
		originalIt(name, fn.length > 0 ? withDone(fn) : fn, timeout),
	originalIt
);

describe("Context (rules and holdouts)", () => {
	const it = doneIt;
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
				applications: [
					{
						name: "website",
					},
				],
				variants: [
					{
						name: "A",
						config: null,
					},
					{
						name: "B",
						config: '{"banner.border":1,"banner.size":"large"}',
					},
				],
				audience: null,
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
				applications: [
					{
						name: "website",
					},
				],
				variants: [
					{
						name: "A",
						config: null,
					},
					{
						name: "B",
						config: '{"button.color":"blue"}',
					},
					{
						name: "C",
						config: '{"button.color":"red"}',
					},
				],
				audience: "",
				customFieldValues: [
					{
						name: "country",
						value: "US,PT,ES,DE,FR",
						type: "string",
					},
					{
						name: "json_object",
						value: '{"123":1,"456":0}',
						type: "json",
					},
					{
						name: "json_array",
						value: '["hello", "world"]',
						type: "json",
					},
					{
						name: "json_number",
						value: "123",
						type: "json",
					},
					{
						name: "json_string",
						value: '"hello"',
						type: "json",
					},
					{
						name: "json_boolean",
						value: "true",
						type: "json",
					},
					{
						name: "json_null",
						value: "null",
						type: "json",
					},
					{
						name: "json_invalid",
						value: "invalid",
						type: "json",
					},
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
				applications: [
					{
						name: "website",
					},
				],
				variants: [
					{
						name: "A",
						config: null,
					},
					{
						name: "B",
						config: '{"card.width":"80%"}',
					},
					{
						name: "C",
						config: '{"card.width":"75%"}',
					},
				],
				audience: "",
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
				applications: [
					{
						name: "website",
					},
				],
				variants: [
					{
						name: "A",
						config: null,
					},
					{
						name: "B",
						config: '{"submit.color":"red","submit.shape":"circle"}',
					},
					{
						name: "C",
						config: '{"submit.color":"blue","submit.shape":"rect"}',
					},
					{
						name: "D",
						config: '{"submit.color":"green","submit.shape":"square"}',
					},
				],
				audience: "",
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
				applications: [
					{
						name: "website",
					},
				],
				variants: [
					{
						name: "A",
						config: null,
					},
					{
						name: "B",
						config: '{"submit.size":"sm"}',
					},
				],
				audience: null,
				customFieldValues: [
					{
						name: "country",
						value: "US,PT,ES",
						type: "string",
					},
					{
						name: "languages",
						value: "en-US,en-GB,pt-PT,pt-BR,es-ES,es-MX",
						type: "string",
					},
					{
						name: "text_field",
						value: "hello text",
						type: "text",
					},
					{
						name: "string_field",
						value: "hello string",
						type: "string",
					},
					{
						name: "number_field",
						value: "123",
						type: "number",
					},
					{
						name: "boolean_field",
						value: "true",
						type: "boolean",
					},
					{
						name: "false_boolean_field",
						value: "false",
						type: "boolean",
					},
					{
						name: "invalid_type_field",
						value: "invalid",
						type: "invalid",
					},
				],
			},
		],
	};

	const refreshContextResponse = Object.assign({}, getContextResponse, {
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
				applications: [
					{
						name: "website",
					},
				],
				variants: [
					{
						name: "A",
						config: null,
					},
					{
						name: "B",
						config: '{"show-modal":true}',
					},
				],
			},
		].concat(getContextResponse.experiments),
	});

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

	const expectedVariants = {
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
							return {
								...v,
								config: JSON.stringify({
									icon: "arrow",
								}),
							};
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
							return {
								...v,
								config: JSON.stringify({ icon: "circle" }),
							};
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
							return {
								...v,
								config: JSON.stringify({
									icon: "arrow",
								}),
							};
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
							return {
								...variant,
								config: JSON.stringify({
									icon: "circle",
								}),
							};
						}
						return variant;
					}),
				};
			}
			return exp;
		}),
	};

	const expectedVariables = {
		"banner.border": 1,
		"banner.size": "large",
		"button.color": "red",
		"submit.color": "blue",
		"submit.shape": "rect",
		"show-modal": true,
		"submit.size": "sm",
	};

	const variableExperiments = {
		"banner.border": ["exp_test_ab"],
		"banner.size": ["exp_test_ab"],
		"button.color": ["exp_test_abc"],
		"card.width": ["exp_test_not_eligible"],
		"submit.color": ["exp_test_fullon"],
		"submit.shape": ["exp_test_fullon"],
		"submit.size": ["exp_test_custom_fields"],
		"show-modal": ["exp_test_new"],
	};

	const publisher = { publish: vi.fn() };
	const provider = { getContextData: vi.fn() };
	const client = {
		getAgent: vi.fn(),
		getApplication: vi.fn(),
		getEnvironment: vi.fn(),
	};
	const sdk = {
		getContextPublisher: vi.fn(),
		getContextDataProvider: vi.fn(),
		getClient: vi.fn(),
		getEventLogger: vi.fn(),
	};

	const contextOptions = {
		publishDelay: -1,
		refreshPeriod: 0,
	};

	const timeOrigin = 1611141535729;

	beforeEach(() => {
		vi.clearAllMocks();
		sdk.getContextDataProvider.mockReturnValue(provider);
		sdk.getContextPublisher.mockReturnValue(publisher);
		sdk.getClient.mockReturnValue(client);
		sdk.getEventLogger.mockReturnValue(SDK.defaultEventLogger);
		client.getAgent.mockReturnValue("absmartly-javascript-sdk");
		client.getApplication.mockReturnValue({ name: "website", version: 0 });
		client.getEnvironment.mockReturnValue("production");
		vi.spyOn(Date, "now").mockImplementation(() => timeOrigin);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("rules evaluation", () => {
		const buildRulesResponse = (overrides = {}) => ({
			...getContextResponse,
			experiments: getContextResponse.experiments.map((x) => {
				if (x.name === "exp_test_abc") {
					return { ...x, ...overrides };
				}
				return x;
			}),
		});

		const rulesContextResponse = buildRulesResponse({
			audience: JSON.stringify({
				filter: [{ value: true }],
			}),
			assignmentRules: JSON.stringify({
				rules: [
					{
						name: "US Internal Users",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [],
						variant: 1,
					},
				],
			}),
		});

		const envScopedRulesContextResponse = buildRulesResponse({
			audience: JSON.stringify({
				filter: [{ value: true }],
			}),
			assignmentRules: JSON.stringify({
				rules: [
					{
						name: "Production Only",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: ["production"],
						variant: 1,
					},
				],
			}),
		});

		const rulesStrictContextResponse = buildRulesResponse({
			audienceStrict: true,
			audience: JSON.stringify({
				filter: [{ gte: [{ var: "age" }, { value: 20 }] }],
			}),
			assignmentRules: JSON.stringify({
				rules: [
					{
						name: "US Users",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [],
						variant: 1,
					},
				],
			}),
		});

		it("should return rule variant when rule matches", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);
		});

		it("should expose a rule that wins over a custom assignment only once", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "US");
			context.customAssignment("exp_test_abc", 2);
			expect(context.treatment("exp_test_abc")).toEqual(1);
			expect(context.treatment("exp_test_abc")).toEqual(1);
			expect(context.pending()).toEqual(1);

			context.attribute("country", "GB");
			expect(context.treatment("exp_test_abc")).toEqual(2);
		});

		it("should not keep a rule variant for an experiment removed on refresh", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);
			expect(context.pending()).toEqual(1);

			const removedResponse = clone(rulesContextResponse);
			removedResponse.experiments = removedResponse.experiments.filter((x) => x.name !== "exp_test_abc");
			provider.getContextData.mockReturnValue(Promise.resolve(removedResponse));

			context.refresh().then(() => {
				expect(context.peek("exp_test_abc")).toEqual(0);
				expect(context.treatment("exp_test_abc")).toEqual(0);
				expect(context.pending()).toEqual(2);
				done();
			});
		});

		it("should parse assignment rules once per context data, not on every lookup", (done) => {
			const rulesString = rulesContextResponse.experiments.find((x) => x.name === "exp_test_abc").assignmentRules;
			const parse = jest.spyOn(JSON, "parse");
			const rulesParses = () => parse.mock.calls.filter(([text]) => text === rulesString).length;

			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			for (const country of ["US", "GB", "US", "DE"]) {
				context.attribute("country", country);
				context.treatment("exp_test_abc");
			}
			expect(rulesParses()).toEqual(1);

			provider.getContextData.mockReturnValue(Promise.resolve(clone(rulesContextResponse)));
			context.refresh().then(() => {
				context.attribute("country", "US");
				expect(context.treatment("exp_test_abc")).toEqual(1);
				expect(rulesParses()).toEqual(2);
				parse.mockRestore();
				done();
			});
		});

		it("should return normal assignment when no rules match", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "GB");
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should skip rule when environment name does not match", () => {
			client.getEnvironment.mockReturnValueOnce("staging");
			const context = new Context(sdk, contextOptions, contextParams, envScopedRulesContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should skip environment-scoped rules when getEnvironment returns undefined", () => {
			client.getEnvironment.mockReturnValueOnce(undefined);
			const context = new Context(sdk, contextOptions, contextParams, envScopedRulesContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should match rule when environment name matches", () => {
			const context = new Context(sdk, contextOptions, contextParams, envScopedRulesContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);
		});

		it("override should take priority over rules", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "US");
			context.override("exp_test_abc", 0);
			expect(context.treatment("exp_test_abc")).toEqual(0);
		});

		it("should set correct flags in exposure when rule matches", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				const publishCall = publisher.publish.mock.calls[0][0];
				const exposure = publishCall.exposures.find((e) => e.name === "exp_test_abc");
				expect(exposure).toMatchObject({
					id: 2,
					name: "exp_test_abc",
					unit: "session_id",
					variant: 1,
					assigned: false,
					eligible: true,
					overridden: false,
					fullOn: false,
					custom: false,
					ruleOverride: true,
				});
				done();
			});
		});

		it("should set correct flags in exposure when no rule matches (normal assignment)", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "GB");
			expect(context.treatment("exp_test_abc")).toEqual(2);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				const publishCall = publisher.publish.mock.calls[0][0];
				const exposure = publishCall.exposures.find((e) => e.name === "exp_test_abc");
				expect(exposure).toMatchObject({
					id: 2,
					name: "exp_test_abc",
					unit: "session_id",
					variant: 2,
					assigned: true,
					eligible: true,
					overridden: false,
					fullOn: false,
					custom: false,
					ruleOverride: false,
				});
				done();
			});
		});

		it("should not evaluate audience when rule matches (audienceMismatch stays false)", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, rulesStrictContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				const publishCall = publisher.publish.mock.calls[0][0];
				const exposure = publishCall.exposures.find((e) => e.name === "exp_test_abc");
				expect(exposure).toMatchObject({
					variant: 1,
					assigned: false,
					eligible: true,
					overridden: false,
					fullOn: false,
					custom: false,
					audienceMismatch: false,
					ruleOverride: true,
				});
				done();
			});
		});

		it("should set correct flags when override takes priority over rule", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "US");
			context.override("exp_test_abc", 0);
			expect(context.treatment("exp_test_abc")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				const publishCall = publisher.publish.mock.calls[0][0];
				const exposure = publishCall.exposures.find((e) => e.name === "exp_test_abc");
				expect(exposure).toMatchObject({
					variant: 0,
					assigned: false,
					overridden: true,
					fullOn: false,
					custom: false,
					ruleOverride: false,
				});
				done();
			});
		});

		it("should set correct override flags even when override variant matches rule variant", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "US");

			expect(context.treatment("exp_test_abc")).toEqual(1);

			context.override("exp_test_abc", 1);

			expect(context.treatment("exp_test_abc")).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				const publishCall = publisher.publish.mock.calls[0][0];
				const exposures = publishCall.exposures.filter((e) => e.name === "exp_test_abc");
				const lastExposure = exposures[exposures.length - 1];
				expect(lastExposure).toMatchObject({
					variant: 1,
					assigned: false,
					overridden: true,
					ruleOverride: false,
				});
				done();
			});
		});

		it("should invalidate cached assignment when rule result changes due to attribute change", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);

			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);

			context.attribute("country", "US");

			expect(context.treatment("exp_test_abc")).toEqual(1);
		});

		it("should invalidate cached assignment when rule stops matching due to attribute change", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);

			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);

			context.attribute("country", "GB");

			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("rule should take priority over audienceStrict when rule matches", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesStrictContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);
		});

		it("should fall back to audienceStrict behavior when no rule matches", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesStrictContextResponse);
			context.attribute("country", "GB");
			expect(context.treatment("exp_test_abc")).toEqual(0);
		});

		it("should set audienceMismatch true when no rule matches and audience mismatches in strict mode", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, rulesStrictContextResponse);
			context.attribute("country", "GB");
			expect(context.treatment("exp_test_abc")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				const publishCall = publisher.publish.mock.calls[0][0];
				const exposure = publishCall.exposures.find((e) => e.name === "exp_test_abc");
				expect(exposure).toMatchObject({
					variant: 0,
					ruleOverride: false,
					audienceMismatch: true,
				});
				done();
			});
		});

		it("should treat an audience that throws as a mismatch so strict audiences fail closed", () => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse);
			context.attribute("age", 25);
			expect(context.peek("exp_test_ab")).toEqual(1);

			const evaluate = jest.spyOn(context._audienceMatcher, "evaluate").mockImplementation(() => {
				throw new Error("audience boom");
			});
			context.attribute("age", 26);
			expect(context.treatment("exp_test_ab")).toEqual(0);
			expect(context._exposures[0].audienceMismatch).toEqual(true);

			const fresh = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse);
			fresh._audienceMatcher.evaluate = evaluate;
			fresh.attribute("age", 25);
			expect(fresh.treatment("exp_test_ab")).toEqual(0);
			expect(fresh._exposures[0].audienceMismatch).toEqual(true);
		});

		it("should return correct variableValue when rule forces a different variant", () => {
			const context = new Context(sdk, contextOptions, contextParams, rulesContextResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);
			expect(context.variableValue("button.color", "default")).toEqual("blue");
		});

		it("should invalidate cache when rule switches to a different matching variant", () => {
			const twoRulesContextResponse = buildRulesResponse({
				audience: JSON.stringify({
					filter: [{ value: true }],
				}),
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "US Users",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
							environments: [],
							variant: 1,
						},
						{
							name: "GB Users",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "GB" }] }] },
							environments: [],
							variant: 2,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, twoRulesContextResponse);

			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);

			context.attribute("country", "GB");
			expect(context.treatment("exp_test_abc")).toEqual(2);
		});

		it("should match rule with multiple and conditions", () => {
			const multiAndResponse = buildRulesResponse({
				audience: JSON.stringify({
					filter: [{ value: true }],
				}),
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "US Internal",
							type: "assign",
							conditions: {
								and: [
									{ eq: [{ var: "country" }, { value: "US" }] },
									{ eq: [{ var: "user_type" }, { value: "internal" }] },
								],
							},
							environments: [],
							variant: 1,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, multiAndResponse);

			context.attribute("country", "US");
			context.attribute("user_type", "internal");
			expect(context.treatment("exp_test_abc")).toEqual(1);

			context.attribute("user_type", "external");
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should match rule scoped to multiple environment names", () => {
			const multiEnvResponse = buildRulesResponse({
				audience: JSON.stringify({
					filter: [{ value: true }],
				}),
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "Prod and Staging",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
							environments: ["production", "staging"],
							variant: 1,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, multiEnvResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);
		});

		it("should evaluate multiple or rules and match the first", () => {
			const multiOrResponse = buildRulesResponse({
				audience: JSON.stringify({
					filter: [{ value: true }],
				}),
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "US Users",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
							environments: [],
							variant: 1,
						},
						{
							name: "GB Users",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "GB" }] }] },
							environments: [],
							variant: 2,
						},
						{
							name: "FR Users",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "FR" }] }] },
							environments: [],
							variant: 0,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, multiOrResponse);

			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(1);

			context.attribute("country", "GB");
			expect(context.treatment("exp_test_abc")).toEqual(2);

			context.attribute("country", "FR");
			expect(context.treatment("exp_test_abc")).toEqual(0);

			context.attribute("country", "DE");
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should fall back to normal assignment when rule variant is out of bounds", () => {
			const oobResponse = buildRulesResponse({
				audience: JSON.stringify({
					filter: [{ value: true }],
				}),
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "OOB Rule",
							type: "assign",
							conditions: null,
							environments: [],
							variant: 99,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, oobResponse);
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should fall back to normal assignment when rule variant is negative", () => {
			const negResponse = buildRulesResponse({
				audience: JSON.stringify({
					filter: [{ value: true }],
				}),
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "Negative Rule",
							type: "assign",
							conditions: null,
							environments: [],
							variant: -1,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, negResponse);
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should set ruleOverride flag when rule forces control variant (0)", (done) => {
			const controlRuleResponse = buildRulesResponse({
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "Force Control",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
							environments: [],
							variant: 0,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, controlRuleResponse);
			context.attribute("country", "US");
			expect(context.treatment("exp_test_abc")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				const publishCall = publisher.publish.mock.calls[0][0];
				const exposure = publishCall.exposures.find((e) => e.name === "exp_test_abc");
				expect(exposure).toMatchObject({
					variant: 0,
					assigned: false,
					eligible: true,
					overridden: false,
					ruleOverride: true,
				});
				done();
			});
		});

		it("should fall back to normal assignment when assignmentRules is invalid JSON", () => {
			const badJsonResponse = buildRulesResponse({
				assignmentRules: "not-valid-json{{{",
			});
			const context = new Context(sdk, contextOptions, contextParams, badJsonResponse);
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should match rule on application attribute when includeSystemAttributes is true", () => {
			const appRuleResponse = buildRulesResponse({
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "Website Only",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "application" }, { value: "website" }] }] },
							environments: [],
							variant: 1,
						},
					],
				}),
			});
			const optionsWithSystemAttrs = {
				publishDelay: -1,
				refreshPeriod: 0,
				includeSystemAttributes: true,
			};
			const context = new Context(sdk, optionsWithSystemAttrs, contextParams, appRuleResponse);
			expect(context.treatment("exp_test_abc")).toEqual(1);
		});

		it("should not match rule on application attribute when includeSystemAttributes is not set", () => {
			const appRuleResponse = buildRulesResponse({
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "Website Only",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "application" }, { value: "website" }] }] },
							environments: [],
							variant: 1,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, appRuleResponse);
			expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
		});

		it("should match rule on environment attribute when includeSystemAttributes is true", () => {
			const envRuleResponse = buildRulesResponse({
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "Production Only",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "environment" }, { value: "production" }] }] },
							environments: [],
							variant: 1,
						},
					],
				}),
			});
			const optionsWithSystemAttrs = {
				publishDelay: -1,
				refreshPeriod: 0,
				includeSystemAttributes: true,
			};
			const context = new Context(sdk, optionsWithSystemAttrs, contextParams, envRuleResponse);
			expect(context.treatment("exp_test_abc")).toEqual(1);
		});

		it("should not invalidate cache when out-of-range rule variant changes to a different out-of-range value", () => {
			const oobRulesResponse = buildRulesResponse({
				audience: JSON.stringify({
					filter: [{ value: true }],
				}),
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "OOB Rule US",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
							environments: [],
							variant: 99,
						},
						{
							name: "OOB Rule GB",
							type: "assign",
							conditions: { and: [{ eq: [{ var: "country" }, { value: "GB" }] }] },
							environments: [],
							variant: 100,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, oobRulesResponse);

			context.attribute("country", "US");
			const first = context.treatment("exp_test_abc");

			context.attribute("country", "GB");
			const second = context.treatment("exp_test_abc");

			expect(first).toEqual(second);
		});

		it("should normalise out-of-range ruleVariant to null in cached assignment", (done) => {
			const oobResponse = buildRulesResponse({
				audience: JSON.stringify({
					filter: [{ value: true }],
				}),
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "OOB Rule",
							type: "assign",
							conditions: null,
							environments: [],
							variant: 99,
						},
					],
				}),
			});
			const context = new Context(sdk, contextOptions, contextParams, oobResponse);
			context.treatment("exp_test_abc");

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				const publishCall = publisher.publish.mock.calls[0][0];
				const exposure = publishCall.exposures.find((e) => e.name === "exp_test_abc");
				expect(exposure.ruleOverride).toBe(false);
				done();
			});
		});

		describe("split rules", () => {
			const splitRulesResponse = (percentages, otherRules = []) =>
				buildRulesResponse({
					assignmentRules: JSON.stringify({
						rules: [
							{
								name: "US Users",
								type: "split",
								conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
								environments: [],
								percentages,
							},
							...otherRules,
						],
					}),
				});

			// With these seeds the unit hashes to ~0.748 (experiment seed) and ~0.682 (traffic seed), and
			// normal assignment gives variant 2, so each way of resolving the split lands on a different variant.
			it("should hash the unit with the experiment seed", () => {
				const context = new Context(sdk, contextOptions, contextParams, splitRulesResponse("70/10/20"));
				context.attribute("country", "US");
				expect(context.treatment("exp_test_abc")).toEqual(1);
			});

			it("should assign the only variant with a non-zero share", () => {
				const context = new Context(sdk, contextOptions, contextParams, splitRulesResponse("0/100/0"));
				context.attribute("country", "US");
				expect(context.treatment("exp_test_abc")).toEqual(1);
			});

			it("should set the same exposure flags as an assign rule", (done) => {
				const context = new Context(sdk, contextOptions, contextParams, splitRulesResponse("0/100/0"));
				context.attribute("country", "US");
				context.treatment("exp_test_abc");

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					const exposure = publisher.publish.mock.calls[0][0].exposures.find((e) => e.name === "exp_test_abc");
					expect(exposure).toEqual({
						id: 2,
						name: "exp_test_abc",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 1,
						assigned: false,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: true,
					});
					done();
				});
			});

			it("should take priority over a custom assignment", () => {
				const context = new Context(sdk, contextOptions, contextParams, splitRulesResponse("0/100/0"));
				context.attribute("country", "US");
				context.customAssignment("exp_test_abc", 2);
				expect(context.treatment("exp_test_abc")).toEqual(1);
			});

			it("should fall back to normal assignment without trying later rules when the split does not cover every variant", () => {
				const laterAssignRule = {
					name: "Everyone",
					type: "assign",
					conditions: null,
					environments: [],
					variant: 1,
				};
				const context = new Context(sdk, contextOptions, contextParams, splitRulesResponse("0/100", [laterAssignRule]));
				context.attribute("country", "US");
				expect(context.treatment("exp_test_abc")).toEqual(expectedVariants["exp_test_abc"]);
			});

			it("should assign variant 0 and stop at the split rule while the unit is missing, then re-resolve once it is set", () => {
				const laterAssignRule = {
					name: "Everyone",
					type: "assign",
					conditions: null,
					environments: [],
					variant: 2,
				};
				const context = new Context(
					sdk,
					contextOptions,
					{ units: { user_id: contextParams.units.user_id } },
					splitRulesResponse("0/100/0", [laterAssignRule])
				);
				context.attribute("country", "US");
				expect(context.peek("exp_test_abc")).toEqual(0);

				context.unit("session_id", contextParams.units.session_id);
				expect(context.peek("exp_test_abc")).toEqual(1);
			});

			it("should keep an assign rule's cached assignment when the unit is set later", () => {
				const context = new Context(
					sdk,
					contextOptions,
					{ units: { user_id: contextParams.units.user_id } },
					rulesContextResponse
				);
				context.attribute("country", "US");
				const assignment = context._assign("exp_test_abc");

				context.unit("session_id", contextParams.units.session_id);
				expect(context._assign("exp_test_abc")).toBe(assignment);
			});

			it("should re-resolve once the unit is set when a split rule starts matching on the same variant as the previous rule", () => {
				const fallbackRule = {
					name: "Everyone",
					type: "assign",
					conditions: null,
					environments: [],
					variant: 0,
				};
				const context = new Context(
					sdk,
					contextOptions,
					{ units: { user_id: contextParams.units.user_id } },
					splitRulesResponse("0/100/0", [fallbackRule])
				);
				expect(context.peek("exp_test_abc")).toEqual(0);

				context.attribute("country", "US");
				expect(context.peek("exp_test_abc")).toEqual(0);

				context.unit("session_id", contextParams.units.session_id);
				expect(context.peek("exp_test_abc")).toEqual(1);
			});

			it("should keep an exposed split on variant 0 after its unit is set, and expose it only once", (done) => {
				const context = new Context(
					sdk,
					contextOptions,
					{ units: { user_id: contextParams.units.user_id } },
					splitRulesResponse("0/100/0")
				);
				context.attribute("country", "US");
				expect(context.treatment("exp_test_abc")).toEqual(0);

				context.unit("session_id", contextParams.units.session_id);
				context.attribute("unrelated", true);
				expect(context.treatment("exp_test_abc")).toEqual(0);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					const exposures = publisher.publish.mock.calls[0][0].exposures;
					expect(exposures.filter((e) => e.name === "exp_test_abc").map((e) => e.variant)).toEqual([0]);
					done();
				});
			});

			it("should keep an exposed split on variant 0 after its unit is set when a custom assignment lost to it", (done) => {
				const context = new Context(
					sdk,
					contextOptions,
					{ units: { user_id: contextParams.units.user_id } },
					splitRulesResponse("0/100/0")
				);
				context.attribute("country", "US");
				context.customAssignment("exp_test_abc", 2);
				expect(context.treatment("exp_test_abc")).toEqual(0);

				context.unit("session_id", contextParams.units.session_id);
				expect(context.treatment("exp_test_abc")).toEqual(0);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					const exposures = publisher.publish.mock.calls[0][0].exposures;
					expect(exposures.filter((e) => e.name === "exp_test_abc").map((e) => e.variant)).toEqual([0]);
					done();
				});
			});

			it("should give the full-on variant while the unit is missing on a full-on experiment", () => {
				const fullOnResponse = buildRulesResponse({
					fullOnVariant: 2,
					assignmentRules: JSON.stringify({
						rules: [
							{
								name: "Everyone",
								type: "split",
								conditions: null,
								environments: [],
								percentages: "0/100/0",
							},
						],
					}),
				});
				const context = new Context(
					sdk,
					contextOptions,
					{ units: { user_id: contextParams.units.user_id } },
					fullOnResponse
				);
				expect(context.peek("exp_test_abc")).toEqual(2);

				context.unit("session_id", contextParams.units.session_id);
				expect(context.peek("exp_test_abc")).toEqual(1);
			});
		});
	});

	describe("holdouts", () => {
		// All fixtures below are ported verbatim (field-for-field) from the real cross-sdk-tests
		// scenario battery at ~/git_tree/sdks/cross-sdk-tests/test_scenarios_complete.json, indices
		// 202-221 (scenarios 203-222). Each it() names the real scenario number it ports. Two
		// scenarios in that range are deliberately not ported 1:1 as separate it() blocks:
		//   - 209 ("Old-Payload Tolerance For Uncovered Experiment") is an inertness baseline that
		//     must pass identically on a holdout-unaware SDK; it exercises no holdout-specific code
		//     path beyond what scenario 206 (opt-in coverage) already covers here.
		//   - 212 ("Independent Holdouts Across Experiments") exercises the same
		//     held-out/not-held-out-with-independent-seeds shape already covered by the combination
		//     of scenarios 203 and 204 below, just spread across two experiments instead of one.
		const buildHoldoutResponse = (experiments, holdouts) => ({ experiments, holdouts });

		// Scenario 203 (index 202): a unit landing in a holdout's variant 0 gets control for the
		// experiment it covers (no exposure of its own) and exactly one exposure for the holdout.
		it("suppresses the covered experiment and fires only the holdout's exposure when held out (scenario 203)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_held_out",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [11],
					},
				],
				[
					{
						id: 11,
						name: "holdout_a",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			expect(context.treatment("exp_holdout_held_out")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 11,
						name: "holdout_a",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 204 (index 203): a unit outside the holdout's suppressed arm assigns to the
		// covered experiment exactly as it would without holdouts, plus one exposure for the
		// holdout carrying its nonzero (not-held-out) variant — holdouts always fire on first
		// evaluation, not only when they actually suppress.
		it("assigns normally and still fires the holdout's own exposure when not held out (scenario 204)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_not_held_out",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [11],
					},
				],
				[
					{
						id: 11,
						name: "holdout_a",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			const notHeldOutParams = { units: { session_id: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3" } };
			const context = new Context(sdk, contextOptions, notHeldOutParams, response);
			expect(context.treatment("exp_holdout_not_held_out")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 1,
						name: "exp_holdout_not_held_out",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
					{
						id: 11,
						name: "holdout_a",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 1,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 205 (index 204): an experiment covered by two holdouts is suppressed if the unit
		// is held out by EITHER one (union semantics). Pinned so the low-id holdout does NOT hold the
		// unit out and the high-id holdout does, ruling out an implementation that only ever consults
		// holdouts[0]. Both holdouts still emit their own independent exposure.
		it("suppresses via union when the higher-id holdout holds the unit out (scenario 205)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_union",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [11, 12],
					},
				],
				[
					{
						id: 11,
						name: "holdout_low_id",
						iteration: 1,
						unitType: "session_id",
						seedHi: 1,
						seedLo: 222,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
					{
						id: 12,
						name: "holdout_high_id",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			expect(context.treatment("exp_holdout_union")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 11,
						name: "holdout_low_id",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 1,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
					{
						id: 12,
						name: "holdout_high_id",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 206 (index 205): holdout coverage never leaks to a sibling experiment lacking
		// holdoutIds, even when that sibling shares the same unit and context as an experiment the
		// same holdout suppresses.
		it("does not leak suppression to a sibling experiment with no holdoutIds (scenario 206)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_covered",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [11],
					},
					{
						id: 2,
						name: "exp_holdout_uncovered_sibling",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
					},
				],
				[
					{
						id: 11,
						name: "holdout_a",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			expect(context.treatment("exp_holdout_covered")).toEqual(0);
			expect(context.treatment("exp_holdout_uncovered_sibling")).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 11,
						name: "holdout_a",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
					{
						id: 2,
						name: "exp_holdout_uncovered_sibling",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 1,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 207 (index 206): a holdoutIds entry with no matching holdouts[] element is
		// silently ignored - wire inconsistency tolerance, not an error - while a second, valid id in
		// the same list still applies normally.
		it("tolerates a dangling holdoutId while a valid one in the same list still applies (scenario 207)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_dangling_plus_valid",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [999, 11],
					},
				],
				[
					{
						id: 11,
						name: "holdout_a",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			expect(() => new Context(sdk, contextOptions, contextParams, response)).not.toThrow();

			const context = new Context(sdk, contextOptions, contextParams, response);
			expect(context.treatment("exp_holdout_dangling_plus_valid")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 11,
						name: "holdout_a",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 208 (index 207): a holdout suppresses a full-on experiment (fullOnVariant != 0)
		// exactly as it does a traffic-eligible one - explicit holdoutIds coverage, not full-on
		// status, decides suppression.
		it("suppresses a full-on experiment regardless of its fullOnVariant (scenario 208)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_fullon",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 2,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
							{ name: "C", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [11],
					},
				],
				[
					{
						id: 11,
						name: "holdout_a",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			expect(context.treatment("exp_holdout_fullon")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 11,
						name: "holdout_a",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 210 (index 209): an explicit override wins over holdout membership for the
		// experiment's own assignment; the override path still evaluates coverage, so the holdout's
		// own exposure fires alongside it.
		it("lets override win the variant while the holdout still fires its own exposure (scenario 210)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_override",
						iteration: 1,
						unitType: "session_id",
						seedHi: 3603515,
						seedLo: 233373850,
						split: [0.5, 0.5],
						trafficSeedHi: 449867249,
						trafficSeedLo: 455443629,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [1],
					},
				],
				[
					{
						id: 1,
						name: "holdout_override_precedence",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			context.override("exp_holdout_override", 1);
			expect(context.treatment("exp_holdout_override")).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 1,
						name: "exp_holdout_override",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 1,
						assigned: false,
						eligible: true,
						overridden: true,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
					{
						id: 1,
						name: "holdout_override_precedence",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 211 (index 210): holdout membership forces control and suppresses the
		// experiment's own exposure even with a custom assignment on file; only the holdout's own
		// exposure fires.
		it("lets holdout suppression beat a custom assignment (scenario 211)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_custom",
						iteration: 1,
						unitType: "session_id",
						seedHi: 3603515,
						seedLo: 233373850,
						split: [0.5, 0.5],
						trafficSeedHi: 449867249,
						trafficSeedLo: 455443629,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [1],
					},
				],
				[
					{
						id: 1,
						name: "holdout_custom_precedence",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			context.customAssignment("exp_holdout_custom", 1);
			expect(context.treatment("exp_holdout_custom")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 1,
						name: "holdout_custom_precedence",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 213 (index 212): the same unit and shared holdout definition produce consistent
		// holdout membership across two different covered experiments; the shared holdout's own
		// exposure fires once on first evaluation and neither covered experiment fires its own
		// exposure — the second call must fire nothing at all, not even a duplicate holdout exposure.
		it("fires a shared holdout's exposure once across two covered experiments (scenario 213)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_shared_a",
						iteration: 1,
						unitType: "session_id",
						seedHi: 3603515,
						seedLo: 233373850,
						split: [0.5, 0.5],
						trafficSeedHi: 449867249,
						trafficSeedLo: 455443629,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [1],
					},
					{
						id: 2,
						name: "exp_shared_b",
						iteration: 1,
						unitType: "session_id",
						seedHi: 3603515,
						seedLo: 233373850,
						split: [0.5, 0.5],
						trafficSeedHi: 449867249,
						trafficSeedLo: 455443629,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [1],
					},
				],
				[
					{
						id: 1,
						name: "holdout_shared",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);

			expect(context.treatment("exp_shared_a")).toEqual(0);
			expect(publisher.publish.mock.calls.length).toEqual(0);
			expect(context.pending()).toEqual(1);

			expect(context.treatment("exp_shared_b")).toEqual(0);
			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 1,
						name: "holdout_shared",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenarios 214-220 (indices 213-219): the three-arm holdout battery. Same shared unit
		// (e791e240fcd3df7d238cfc285f475e8152fcc0ec) throughout; each scenario pins a distinct arm
		// semantic.
		describe("holdout arms battery", () => {
			// Scenario 214 (index 213): a 3-arm holdout's variant 0 forces control for every covered
			// experiment, full-on or not, identically to a 2-arm holdout's variant 0; the holdout's
			// own exposure fires once at variant 0 and neither covered experiment emits its own
			// exposure.
			it("3-arm variant 0 holds out both full-on and non-full-on covered experiments (scenario 214)", (done) => {
				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_three_arm_0_non_fullon",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 0,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [21],
						},
						{
							id: 2,
							name: "exp_three_arm_0_fullon",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 2,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
								{ name: "C", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [21],
						},
					],
					[
						{
							id: 21,
							name: "holdout_three_arm_v0",
							iteration: 1,
							unitType: "session_id",
							seedHi: 0,
							seedLo: 1,
							split: [0.3, 0.3, 0.4],
							holdoutType: "all_full_on",
						},
					]
				);

				const context = new Context(sdk, contextOptions, contextParams, response);

				expect(context.treatment("exp_three_arm_0_non_fullon")).toEqual(0);
				expect(context.pending()).toEqual(1);

				expect(context.treatment("exp_three_arm_0_fullon")).toEqual(0);
				expect(context.pending()).toEqual(1);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
						{
							id: 21,
							name: "holdout_three_arm_v0",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 0,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
					]);
					done();
				});
			});

			// Scenario 215 (index 214): a 3-arm holdout's variant 1 forces control only for a covered
			// experiment with fullOnVariant==0; a covered full-on experiment (fullOnVariant!=0) takes
			// its normal assignment path and is assigned its own fullOnVariant with fullOn=true, not
			// suppressed.
			it("3-arm variant 1 holds out only the non-full-on experiment (scenario 215)", (done) => {
				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_three_arm_1_non_fullon",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 0,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [22],
						},
						{
							id: 2,
							name: "exp_three_arm_1_fullon",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 2,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
								{ name: "C", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [22],
						},
					],
					[
						{
							id: 22,
							name: "holdout_three_arm_v1",
							iteration: 1,
							unitType: "session_id",
							seedHi: 0,
							seedLo: 3,
							split: [0.3, 0.3, 0.4],
							holdoutType: "all_full_on",
						},
					]
				);

				const context = new Context(sdk, contextOptions, contextParams, response);
				expect(context.treatment("exp_three_arm_1_non_fullon")).toEqual(0);
				expect(context.treatment("exp_three_arm_1_fullon")).toEqual(2);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
						{
							id: 22,
							name: "holdout_three_arm_v1",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
						{
							id: 2,
							name: "exp_three_arm_1_fullon",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 2,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: true,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
					]);
					done();
				});
			});

			// Scenario 216 (index 215): a 3-arm holdout's variant 2 (normal traffic) evaluates every
			// covered experiment exactly as if uncovered, full-on or not; the holdout's own exposure
			// fires once at variant 2.
			it("3-arm variant 2 defers to the normal path for every covered experiment (scenario 216)", (done) => {
				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_three_arm_2_non_fullon",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 0,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [23],
						},
						{
							id: 2,
							name: "exp_three_arm_2_fullon",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 2,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
								{ name: "C", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [23],
						},
					],
					[
						{
							id: 23,
							name: "holdout_three_arm_v2",
							iteration: 1,
							unitType: "session_id",
							seedHi: 0,
							seedLo: 0,
							split: [0.3, 0.3, 0.4],
							holdoutType: "all_full_on",
						},
					]
				);

				const context = new Context(sdk, contextOptions, contextParams, response);
				expect(context.treatment("exp_three_arm_2_non_fullon")).toEqual(1);
				expect(context.treatment("exp_three_arm_2_fullon")).toEqual(2);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
						{
							id: 1,
							name: "exp_three_arm_2_non_fullon",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
						{
							id: 23,
							name: "holdout_three_arm_v2",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 2,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
						{
							id: 2,
							name: "exp_three_arm_2_fullon",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 2,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: true,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
					]);
					done();
				});
			});

			// Scenario 217 (index 216): a full-on experiment covered by a 3-arm holdout's variant 1 is
			// not short-circuited to its fullOnVariant: audienceStrict is evaluated first, so an
			// audience mismatch still forces control (not suppression) with assigned=false and
			// audienceMismatch=true; the experiment's own exposure fires because it was evaluated and
			// rejected by audience, not held out.
			it("3-arm variant 1 defers to the normal path for an audience mismatch (scenario 217)", (done) => {
				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_three_arm_1_audience_fullon",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 2,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
								{ name: "C", config: null },
							],
							audience: JSON.stringify({ filter: [{ gte: [{ var: "age" }, { value: 20 }] }] }),
							audienceStrict: true,
							customFieldValues: null,
							holdoutIds: [24],
						},
					],
					[
						{
							id: 24,
							name: "holdout_three_arm_v1",
							iteration: 1,
							unitType: "session_id",
							seedHi: 0,
							seedLo: 3,
							split: [0.3, 0.3, 0.4],
							holdoutType: "all_full_on",
						},
					]
				);

				const context = new Context(sdk, contextOptions, contextParams, response);
				context.attribute("age", 5);
				expect(context.treatment("exp_three_arm_1_audience_fullon")).toEqual(0);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
						{
							id: 1,
							name: "exp_three_arm_1_audience_fullon",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 0,
							assigned: false,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: true,
							ruleOverride: false,
						},
						{
							id: 24,
							name: "holdout_three_arm_v1",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
					]);
					done();
				});
			});

			// Scenario 218 (index 217): the same full-on/audience-mismatch experiment, covered
			// instead by the 3-arm holdout's variant 2 (normal traffic), yields the identical verdict
			// as scenario 217's variant 1: control, assigned=false, audienceMismatch=true. Pins that
			// arm 1 defers to the normal assignment path instead of short-circuiting to the full-on
			// variant.
			it("3-arm variant 2 reaches the identical audience-mismatch verdict as variant 1 (scenario 218)", (done) => {
				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_three_arm_2_audience_fullon",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 2,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
								{ name: "C", config: null },
							],
							audience: JSON.stringify({ filter: [{ gte: [{ var: "age" }, { value: 20 }] }] }),
							audienceStrict: true,
							customFieldValues: null,
							holdoutIds: [25],
						},
					],
					[
						{
							id: 25,
							name: "holdout_three_arm_v2",
							iteration: 1,
							unitType: "session_id",
							seedHi: 0,
							seedLo: 0,
							split: [0.3, 0.3, 0.4],
							holdoutType: "all_full_on",
						},
					]
				);

				const context = new Context(sdk, contextOptions, contextParams, response);
				context.attribute("age", 5);
				expect(context.treatment("exp_three_arm_2_audience_fullon")).toEqual(0);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
						{
							id: 1,
							name: "exp_three_arm_2_audience_fullon",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 0,
							assigned: false,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: true,
							ruleOverride: false,
						},
						{
							id: 25,
							name: "holdout_three_arm_v2",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 2,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
					]);
					done();
				});
			});

			// Scenario 219 (index 218): a covered experiment is suppressed if EITHER applicable
			// holdout holds it out, even when a 3-arm holdout's own arm (variant 2, normal traffic)
			// would not have held it out on its own; both holdouts still emit their own independent
			// exposure with their own variant. A second experiment covered only by the
			// non-suppressing 3-arm holdout takes its normal assignment path and emits its own
			// exposure, proving that holdout 22's arm is not itself suppressing.
			it("union: a 2-arm holdout holds out while the applicable 3-arm holdout does not (scenario 219)", (done) => {
				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_union_two_arm_wins",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 0,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [11, 22],
						},
						{
							id: 2,
							name: "exp_only_three_arm_normal_path",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 0,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [22],
						},
					],
					[
						{
							id: 11,
							name: "holdout_union_two_arm",
							iteration: 1,
							unitType: "session_id",
							seedHi: 13,
							seedLo: 111,
							split: [0.1, 0.9],
						},
						{
							id: 22,
							name: "holdout_union_three_arm",
							iteration: 1,
							unitType: "session_id",
							seedHi: 0,
							seedLo: 0,
							split: [0.3, 0.3, 0.4],
							holdoutType: "all_full_on",
						},
					]
				);

				const context = new Context(sdk, contextOptions, contextParams, response);
				expect(context.treatment("exp_union_two_arm_wins")).toEqual(0);
				expect(context.treatment("exp_only_three_arm_normal_path")).toEqual(1);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
						{
							id: 11,
							name: "holdout_union_two_arm",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 0,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
						{
							id: 22,
							name: "holdout_union_three_arm",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 2,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
						{
							id: 2,
							name: "exp_only_three_arm_normal_path",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
					]);
					done();
				});
			});

			// Scenario 220 (index 219): union, the other direction: a 3-arm holdout's variant 1 holds
			// a non-full-on covered experiment out even when an applicable 2-arm holdout alone would
			// not have; both holdouts still emit their own independent exposure with their own
			// variant. A second experiment covered only by the non-suppressing 2-arm holdout takes its
			// normal assignment path and emits its own exposure, proving that holdout 11's arm is not
			// itself suppressing.
			it("union: a 3-arm holdout holds out while the applicable 2-arm holdout does not (scenario 220)", (done) => {
				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_union_three_arm_wins",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 0,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [11, 22],
						},
						{
							id: 2,
							name: "exp_only_two_arm_normal_path",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0.0, 1.0],
							fullOnVariant: 0,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [11],
						},
					],
					[
						{
							id: 11,
							name: "holdout_union_two_arm",
							iteration: 1,
							unitType: "session_id",
							seedHi: 1,
							seedLo: 222,
							split: [0.1, 0.9],
						},
						{
							id: 22,
							name: "holdout_union_three_arm",
							iteration: 1,
							unitType: "session_id",
							seedHi: 0,
							seedLo: 3,
							split: [0.3, 0.3, 0.4],
							holdoutType: "all_full_on",
						},
					]
				);

				const context = new Context(sdk, contextOptions, contextParams, response);
				expect(context.treatment("exp_union_three_arm_wins")).toEqual(0);
				expect(context.treatment("exp_only_two_arm_normal_path")).toEqual(1);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
						{
							id: 11,
							name: "holdout_union_two_arm",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
						{
							id: 22,
							name: "holdout_union_three_arm",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
						{
							id: 2,
							name: "exp_only_two_arm_normal_path",
							unit: "session_id",
							exposedAt: timeOrigin,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: false,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
					]);
					done();
				});
			});
		});

		// Scenario 221 (index 220): a covered full-on experiment can resolve before its unit type is
		// installed; after unit() supplies that unit, resolving it again publishes the holdout
		// exposure that was unavailable during the first evaluation.
		it("publishes the previously-unavailable holdout exposure once its late unit is set (scenario 221)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_late_unit_fullon",
						iteration: 1,
						unitType: "user_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5, 0.0],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 2,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
							{ name: "C", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [11],
					},
				],
				[
					{
						id: 11,
						name: "holdout_late_user_id",
						iteration: 1,
						unitType: "user_id",
						seedHi: 1,
						seedLo: 222,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			const lateUnitParams = { units: { session_id: "context-created-without-user-id" } };
			const context = new Context(sdk, contextOptions, lateUnitParams, response);

			// Before the covered unit type is installed: resolves via the full-on path (no unit
			// needed for that), the holdout can't be resolved yet, and peek() fires no exposures.
			expect(context.peek("exp_holdout_late_unit_fullon")).toEqual(2);
			expect(context.pending()).toEqual(0);

			context.unit("user_id", "e791e240fcd3df7d238cfc285f475e8152fcc0ec");

			expect(context.treatment("exp_holdout_late_unit_fullon")).toEqual(2);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 1,
						name: "exp_holdout_late_unit_fullon",
						unit: "user_id",
						exposedAt: timeOrigin,
						variant: 2,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: true,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
					{
						id: 11,
						name: "holdout_late_user_id",
						unit: "user_id",
						exposedAt: timeOrigin,
						variant: 1,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// Scenario 222 (index 221): identical to scenario 214 (three-arm variant 0), but the holdout
		// definition omits the holdoutType field entirely. An SDK must derive the holdout's arm count
		// from its split length alone, so suppression of both the full-on and non-full-on covered
		// experiments is unchanged. Pins that holdoutType is not required on the wire and arm count
		// is never read from it.
		it("derives 3-arm arity from split length alone, with no holdoutType field on the wire (scenario 222)", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_three_arm_0_non_fullon",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0.0, 1.0],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [21],
					},
					{
						id: 2,
						name: "exp_three_arm_0_fullon",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0.0, 1.0],
						fullOnVariant: 2,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
							{ name: "C", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutIds: [21],
					},
				],
				[
					{
						id: 21,
						name: "holdout_arity_from_split",
						iteration: 1,
						unitType: "session_id",
						seedHi: 0,
						seedLo: 1,
						split: [0.3, 0.3, 0.4],
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			expect(context.treatment("exp_three_arm_0_non_fullon")).toEqual(0);
			expect(context.treatment("exp_three_arm_0_fullon")).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 21,
						name: "holdout_arity_from_split",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		// A matching assignmentRules rule (a JS-SDK-only feature) wins over holdout suppression,
		// the same way an explicit override() does: it's an author-specified assignment (flagged
		// `ruleOverride`, excluded from stats), not the experiment's own randomized/custom path
		// that suppression is meant to gate. The holdout fixture (id 11, seedHi 13, seedLo 111,
		// split [0.1, 0.9]) is identical to scenario 203's holdout_a, which is already proven to
		// hold out the default `contextParams` unit — proving suppression is genuinely in play
		// here and the rule is what overrides it, not merely the holdout never applying.
		it("lets a matching assignment rule's variant win over holdout suppression", (done) => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_rules",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						assignmentRules: JSON.stringify({
							rules: [
								{
									name: "US Internal Users",
									type: "assign",
									conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
									environments: [],
									variant: 1,
								},
							],
						}),
						customFieldValues: null,
						holdoutIds: [11],
					},
				],
				[
					{
						id: 11,
						name: "holdout_rules_suppression",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			context.attribute("country", "US");

			expect(context.treatment("exp_holdout_rules")).toEqual(1);

			const assignment = context._assignments["exp_holdout_rules"];
			expect(assignment.ruleOverride).toEqual(true);
			expect(assignment.assigned).toEqual(false);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish.mock.calls[0][0].exposures).toEqual([
					{
						id: 1,
						name: "exp_holdout_rules",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 1,
						assigned: false,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: true,
					},
					{
						id: 11,
						name: "holdout_rules_suppression",
						unit: "session_id",
						exposedAt: timeOrigin,
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					},
				]);
				done();
			});
		});

		it("lets a matching split rule win over holdout suppression", () => {
			const response = buildHoldoutResponse(
				[
					{
						id: 1,
						name: "exp_holdout_split_rule",
						iteration: 1,
						unitType: "session_id",
						seedHi: 100,
						seedLo: 200,
						split: [0.5, 0.5],
						trafficSeedHi: 1,
						trafficSeedLo: 2,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [{ name: "website" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						assignmentRules: JSON.stringify({
							rules: [
								{
									name: "US Users",
									type: "split",
									conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
									environments: [],
									percentages: "0/100",
								},
							],
						}),
						customFieldValues: null,
						holdoutIds: [11],
					},
				],
				[
					{
						id: 11,
						name: "holdout_split_rule_suppression",
						iteration: 1,
						unitType: "session_id",
						seedHi: 13,
						seedLo: 111,
						split: [0.1, 0.9],
						trafficSeedHi: 0,
						trafficSeedLo: 0,
						trafficSplit: [0, 1],
						fullOnVariant: 0,
						applications: [],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: null,
						audienceStrict: false,
						customFieldValues: null,
						holdoutType: "full",
					},
				]
			);

			const context = new Context(sdk, contextOptions, contextParams, response);
			context.attribute("country", "US");

			expect(context.treatment("exp_holdout_split_rule")).toEqual(1);
			expect(context._assignments["exp_holdout_split_rule"].suppressed).toEqual(true);
		});

		// An overridden assignment cached without holdout coverage must be rebuilt when a refresh
		// adds holdouts to the same experiment, so the holdout's own exposure can fire.
		it("Task 5 regression: override fast path revalidates the holdout set added by a refresh (I-2 Test A)", (done) => {
			const baseExperiment = {
				id: 1,
				name: "exp_override_holdout_added",
				iteration: 1,
				unitType: "session_id",
				seedHi: 100,
				seedLo: 200,
				split: [0.5, 0.5],
				trafficSeedHi: 1,
				trafficSeedLo: 2,
				trafficSplit: [0, 1],
				fullOnVariant: 0,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: null },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: null,
			};

			const initialResponse = buildHoldoutResponse([baseExperiment], []);

			const holdout = {
				id: 11,
				name: "holdout_added_after_override",
				iteration: 1,
				unitType: "session_id",
				seedHi: 13,
				seedLo: 111,
				split: [0.1, 0.9],
				trafficSeedHi: 0,
				trafficSeedLo: 0,
				trafficSplit: [0, 1],
				fullOnVariant: 0,
				applications: [],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: null },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: null,
				holdoutType: "full",
			};

			const refreshedResponse = buildHoldoutResponse([{ ...baseExperiment, holdoutIds: [11] }], [holdout]);

			const context = new Context(sdk, contextOptions, contextParams, initialResponse);
			context.override("exp_override_holdout_added", 1);

			expect(context.treatment("exp_override_holdout_added")).toEqual(1);
			expect(context.pending()).toEqual(1);

			provider.getContextData.mockReturnValue(Promise.resolve(refreshedResponse));

			context.refresh().then(() => {
				expect(context.treatment("exp_override_holdout_added")).toEqual(1);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					const exposures = publisher.publish.mock.calls[0][0].exposures;
					const holdoutExposure = exposures.find((e) => e.name === "holdout_added_after_override");

					expect(holdoutExposure).toMatchObject({
						id: 11,
						unit: "session_id",
						variant: 0,
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					});
					done();
				});
			});
		});

		// Suppression must use the holdout arm count pinned on the cached holdout assignment, not the
		// live split length, when the split changes without a new iteration.
		//
		// Construct: resolve a 2-arm holdout for one experiment (pinning holdoutArmCount: 2 and
		// variant: 1, both cached independently of any one covered experiment). Refresh so the
		// SAME holdout (same id, same iteration) now reports a 3-arm split. Query a SECOND,
		// previously-unqueried experiment (fullOnVariant: 0, the arm-1-specific case per
		// isHeldOutBy) covered by the same holdout: its own assignment is built fresh, so it must
		// resolve the holdout via `_getHoldoutAssignment`, hitting the (id, iteration) cache seeded
		// by the first experiment. The seeds are chosen so the two arm counts disagree on the
		// verdict: isHeldOutBy(1, 2, fullOnVariant=0) is false (2-arm, non-suppressing) but
		// isHeldOutBy(1, 3, fullOnVariant=0) is true (3-arm variant 1 forces control when
		// fullOnVariant===0) — so if the live (3) arm count were used instead of the pinned (2)
		// one, the second experiment would flip from "assigned normally" to "suppressed
		// (assigned: false, no own exposure)". Asserting it stays assigned normally (with its own
		// exposure firing) after the refresh proves the pinned value governs, not the live one.
		it("Task 5 regression: same-iteration holdout split-length change does not desync the pinned arm count (I-2 Test B)", (done) => {
			const holdoutTwoArm = {
				id: 11,
				name: "holdout_pin_test",
				iteration: 1,
				unitType: "session_id",
				seedHi: 13,
				seedLo: 111,
				split: [0.1, 0.9],
				trafficSeedHi: 0,
				trafficSeedLo: 0,
				trafficSplit: [0, 1],
				fullOnVariant: 0,
				applications: [],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: null },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: null,
				holdoutType: "full",
			};

			const expA = {
				id: 1,
				name: "exp_pin_seed_a",
				iteration: 1,
				unitType: "session_id",
				seedHi: 100,
				seedLo: 200,
				split: [0.5, 0.5],
				trafficSeedHi: 1,
				trafficSeedLo: 2,
				trafficSplit: [0, 1],
				fullOnVariant: 0,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: null },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: null,
				holdoutIds: [11],
			};

			const initialResponse = buildHoldoutResponse([expA], [holdoutTwoArm]);

			// Same unit hashed by scenario 204 to resolve this identical holdout definition
			// (seedHi 13, seedLo 111, split [0.1, 0.9]) to variant 1 — i.e. NOT held out under a
			// 2-arm interpretation.
			const pinParams = { units: { session_id: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3" } };
			const context = new Context(sdk, contextOptions, pinParams, initialResponse);

			expect(context.treatment("exp_pin_seed_a")).toEqual(0);

			// fullOnVariant: 0 is the key choice here — isHeldOutBy's 3-arm/variant-1 rule only
			// forces control when the covered experiment's fullOnVariant === 0, so this is the
			// only shape where the pinned (2) vs. live (3) arm count actually disagree on the
			// suppression verdict.
			const expB = {
				...expA,
				id: 2,
				name: "exp_pin_seed_b",
			};

			const holdoutThreeArm = { ...holdoutTwoArm, split: [0.3, 0.3, 0.4] };

			const refreshedResponse = buildHoldoutResponse([expA, expB], [holdoutThreeArm]);

			provider.getContextData.mockReturnValue(Promise.resolve(refreshedResponse));

			context.refresh().then(() => {
				// With the pinned arm count, isHeldOutBy(1, 2, 0) is false, so the assignment is not
				// suppressed and its own exposure fires. The live arm count (3) would suppress it.
				context.treatment("exp_pin_seed_b");

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					const exposures = publisher.publish.mock.calls[0][0].exposures;
					const ownExposure = exposures.find((e) => e.name === "exp_pin_seed_b");

					expect(ownExposure).toMatchObject({
						assigned: true,
						eligible: true,
						overridden: false,
						fullOn: false,
						custom: false,
						audienceMismatch: false,
						ruleOverride: false,
					});
					done();
				});
			});
		});

		// This behavior is inherited from java-sdk's Context (Context.java:325-381,
		// invalidateAssignmentsPinnedWithMissingUnit) and is intentionally left unchanged here for
		// parity. Documented as known behavior, not a target for a JS-only fix.
		describe("holdouts: known java-sdk-parity behavior (not fixed here)", () => {
			// A full-on experiment's own variant never needs a unit, so treatment() can resolve and
			// expose it before the covered experiment's unit type is ever installed. If a holdout
			// covering it also needs that unit, its own assignment resolves to null and gets pinned
			// into the (now-exposed) assignment's holdoutAssignments. Once installed, `unit()`'s
			// eviction only clears UNEXPOSED assignments (to avoid double-firing the covered
			// experiment's own exposure — see the next test) — so this assignment, already exposed,
			// is never evicted, and the holdout's null entry can never be repaired. The holdout's own
			// exposure is lost for the life of the context. java-sdk has the identical gap.
			it("permanently loses a holdout's exposure when treatment() (not peek()) resolves a full-on experiment before its unit is set", (done) => {
				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_holdout_treatment_before_unit",
							iteration: 1,
							unitType: "user_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5, 0.0],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0, 1],
							fullOnVariant: 2,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
								{ name: "C", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [11],
						},
					],
					[
						{
							id: 11,
							name: "holdout_treatment_before_unit",
							iteration: 1,
							unitType: "user_id",
							seedHi: 1,
							seedLo: 222,
							split: [0.1, 0.9],
							trafficSeedHi: 0,
							trafficSeedLo: 0,
							trafficSplit: [0, 1],
							fullOnVariant: 0,
							applications: [],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutType: "full",
						},
					]
				);

				const lateUnitParams = { units: { session_id: "context-created-without-user-id" } };
				const context = new Context(sdk, contextOptions, lateUnitParams, response);

				expect(context.treatment("exp_holdout_treatment_before_unit")).toEqual(2);
				expect(context.pending()).toEqual(1);

				context.unit("user_id", "e791e240fcd3df7d238cfc285f475e8152fcc0ec");

				expect(context.treatment("exp_holdout_treatment_before_unit")).toEqual(2);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.publish().then(() => {
					const exposures = publisher.publish.mock.calls[0][0].exposures;
					// Known limitation: only the covered experiment's own exposure is ever published.
					// The holdout's exposure never fires, even though its unit is now available.
					expect(exposures).toEqual([
						{
							id: 1,
							name: "exp_holdout_treatment_before_unit",
							unit: "user_id",
							exposedAt: timeOrigin,
							variant: 2,
							assigned: true,
							eligible: true,
							overridden: false,
							fullOn: true,
							custom: false,
							audienceMismatch: false,
							ruleOverride: false,
						},
					]);
					done();
				});
			});

			// This behavior is inherited from java-sdk's Context (Context.java:974-1005,
			// experimentMatches/holdoutSetMatches) and is intentionally left unchanged here for
			// parity. Documented as known behavior, not a target for a JS-only fix.
			//
			// experimentMatches() folds holdoutSetMatches() into its cache-validity check, so ANY
			// change to an experiment's applicable-holdout set — even adding a holdout that does not
			// end up suppressing the unit — invalidates the cached assignment and forces a full
			// rebuild via _assign(), which starts the new Assignment with exposed: false regardless
			// of whether the resolved variant/suppression outcome actually changed. If the covered
			// experiment had already fired its own exposure before the refresh, the next treatment()
			// call fires it again. java-sdk has the identical gap: the covered-experiment side of
			// this exact scenario is untested there for the non-override path, but the override path
			// has an equivalent, explicitly-asserted duplicate (see
			// holdoutBecomingApplicableAfterRefreshStillFiresForOverriddenExperiment in
			// ContextHoldoutTest.java), governed by the same experimentMatches/holdoutSetMatches
			// mechanism.
			it("duplicates the covered experiment's own exposure when a refresh adds a non-suppressing holdout to an already-exposed experiment", (done) => {
				const baseExperiment = {
					id: 1,
					name: "exp_holdout_added_non_suppressing",
					iteration: 1,
					unitType: "session_id",
					seedHi: 100,
					seedLo: 200,
					split: [0.5, 0.5],
					trafficSeedHi: 1,
					trafficSeedLo: 2,
					trafficSplit: [0, 1],
					fullOnVariant: 1,
					applications: [{ name: "website" }],
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: null },
					],
					audience: null,
					audienceStrict: false,
					customFieldValues: null,
				};

				const initialResponse = buildHoldoutResponse([baseExperiment], []);

				const context = new Context(sdk, contextOptions, contextParams, initialResponse);

				expect(context.treatment("exp_holdout_added_non_suppressing")).toEqual(1);
				expect(context.pending()).toEqual(1);

				const nonSuppressingHoldout = {
					id: 11,
					name: "holdout_non_suppressing",
					iteration: 1,
					unitType: "session_id",
					seedHi: 13,
					seedLo: 111,
					// This unit always lands in variant 1 of this holdout, which never holds out a
					// full-on-variant-1 experiment (isHeldOutBy only suppresses on variant 0, or
					// variant 1 of a 3-arm holdout when fullOnVariant === 0).
					split: [0.0, 1.0],
					trafficSeedHi: 0,
					trafficSeedLo: 0,
					trafficSplit: [0, 1],
					fullOnVariant: 0,
					applications: [],
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: null },
					],
					audience: null,
					audienceStrict: false,
					customFieldValues: null,
					holdoutType: "full",
				};

				const refreshedResponse = buildHoldoutResponse(
					[{ ...baseExperiment, holdoutIds: [11] }],
					[nonSuppressingHoldout]
				);

				provider.getContextData.mockReturnValue(Promise.resolve(refreshedResponse));

				context.refresh().then(() => {
					// Known limitation: the covered experiment's outcome hasn't changed (still
					// variant 1, still not suppressed), but the holdout-set change alone forces a
					// rebuild that re-fires its own exposure.
					expect(context.treatment("exp_holdout_added_non_suppressing")).toEqual(1);

					publisher.publish.mockReturnValue(Promise.resolve());

					context.publish().then(() => {
						const exposures = publisher.publish.mock.calls[0][0].exposures;
						const ownExposures = exposures.filter((e) => e.name === "exp_holdout_added_non_suppressing");

						expect(ownExposures).toHaveLength(2);

						const holdoutExposures = exposures.filter((e) => e.name === "holdout_non_suppressing");
						expect(holdoutExposures).toHaveLength(1);

						done();
					});
				});
			});
		});

		describe("holdouts: error handling", () => {
			it("keeps a queued exposure even when the eventLogger throws while reporting it", () => {
				const throwingEventLogger = jest.fn((ctx, eventName) => {
					if (eventName === "exposure") {
						throw new Error("logger boom");
					}
				});

				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_holdout_throwing_logger",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0, 1],
							fullOnVariant: 1,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
						},
					],
					[]
				);

				const context = new Context(
					sdk,
					{ ...contextOptions, eventLogger: throwingEventLogger },
					contextParams,
					response
				);

				expect(() => context.treatment("exp_holdout_throwing_logger")).not.toThrow();

				expect(context.pending()).toEqual(1);
			});

			it("queues every exposure even when the eventLogger throws while reporting each one", () => {
				const eventLogger = jest.fn((ctx, eventName, data) => {
					if (eventName === "exposure") {
						throw new Error(`boom for ${data.name}`);
					}
				});

				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_holdout_multi_error",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0, 1],
							fullOnVariant: 1,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [11, 12],
						},
					],
					[
						{
							id: 11,
							name: "holdout_multi_error_a",
							iteration: 1,
							unitType: "session_id",
							seedHi: 1,
							seedLo: 111,
							split: [0.0, 1.0],
							trafficSeedHi: 0,
							trafficSeedLo: 0,
							trafficSplit: [0, 1],
							fullOnVariant: 0,
							applications: [],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutType: "full",
						},
						{
							id: 12,
							name: "holdout_multi_error_b",
							iteration: 1,
							unitType: "session_id",
							seedHi: 2,
							seedLo: 222,
							split: [0.0, 1.0],
							trafficSeedHi: 0,
							trafficSeedLo: 0,
							trafficSplit: [0, 1],
							fullOnVariant: 0,
							applications: [],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutType: "full",
						},
					]
				);

				const context = new Context(sdk, { ...contextOptions, eventLogger }, contextParams, response);

				expect(() => context.treatment("exp_holdout_multi_error")).not.toThrow();

				const exposureCalls = eventLogger.mock.calls.filter((c) => c[1] === "exposure");
				expect(exposureCalls.map((c) => c[2].name).sort()).toEqual(
					["exp_holdout_multi_error", "holdout_multi_error_a", "holdout_multi_error_b"].sort()
				);

				expect(context.pending()).toEqual(3);
			});

			// A throwing eventLogger (for both "exposure" and "error" events) is isolated by
			// _logEvent/_logError themselves (neither ever propagates — see their doc comments), so it
			// must not interrupt exposure processing: it must not prevent the holdout loop from running
			// after the covered experiment's own exposure is reported, and both exposures must still
			// be queued.
			it("does not let a throwing error-event logger interrupt exposure processing", () => {
				const eventLogger = jest.fn((ctx, eventName, data) => {
					if (eventName === "exposure") {
						throw new Error(`exposure boom for ${data.name}`);
					}
					if (eventName === "error") {
						throw new Error("error-handler boom");
					}
				});

				const response = buildHoldoutResponse(
					[
						{
							id: 1,
							name: "exp_holdout_throwing_error_logger",
							iteration: 1,
							unitType: "session_id",
							seedHi: 100,
							seedLo: 200,
							split: [0.5, 0.5],
							trafficSeedHi: 1,
							trafficSeedLo: 2,
							trafficSplit: [0, 1],
							fullOnVariant: 1,
							applications: [{ name: "website" }],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutIds: [11],
						},
					],
					[
						{
							id: 11,
							name: "holdout_throwing_error_logger",
							iteration: 1,
							unitType: "session_id",
							seedHi: 1,
							seedLo: 111,
							split: [0.0, 1.0],
							trafficSeedHi: 0,
							trafficSeedLo: 0,
							trafficSplit: [0, 1],
							fullOnVariant: 0,
							applications: [],
							variants: [
								{ name: "A", config: null },
								{ name: "B", config: null },
							],
							audience: null,
							audienceStrict: false,
							customFieldValues: null,
							holdoutType: "full",
						},
					]
				);

				const context = new Context(sdk, { ...contextOptions, eventLogger }, contextParams, response);

				expect(() => context.treatment("exp_holdout_throwing_error_logger")).not.toThrow();

				const exposureCalls = eventLogger.mock.calls.filter((c) => c[1] === "exposure");
				expect(exposureCalls.map((c) => c[2].name).sort()).toEqual(
					["exp_holdout_throwing_error_logger", "holdout_throwing_error_logger"].sort()
				);

				expect(context.pending()).toEqual(2);
			});
		});

		describe("holdouts: variable resolution", () => {
			// Ported from java-sdk's getVariableAssignment (Context.java:1332-1373). A suppressed
			// experiment must never win variable-key resolution over one that is genuinely
			// assigned/overridden, but it must still be usable as a fallback: a held-out unit reads
			// the experiment's own control-variant value, not the caller's default, so it stays
			// indistinguishable from a control unit for variable resolution purposes.
			const holdoutVarExperiment = (over) => ({
				id: 1,
				name: "exp_holdout_var",
				iteration: 1,
				unitType: "session_id",
				seedHi: 100,
				seedLo: 200,
				split: [0.5, 0.5],
				trafficSeedHi: 1,
				trafficSeedLo: 2,
				trafficSplit: [0, 1],
				fullOnVariant: 0,
				applications: [{ name: "website" }],
				variants: [
					{ name: "A", config: JSON.stringify({ "button.color": "CONTROL_GREY" }) },
					{ name: "B", config: JSON.stringify({ "button.color": "TREATMENT_GREEN" }) },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: null,
				holdoutIds: [11],
				...over,
			});

			const alwaysHoldsOut = (over) => ({
				id: 11,
				name: "holdout_var",
				iteration: 1,
				unitType: "session_id",
				seedHi: 13,
				seedLo: 111,
				split: [1.0, 0.0],
				trafficSeedHi: 0,
				trafficSeedLo: 0,
				trafficSplit: [0, 1],
				fullOnVariant: 0,
				applications: [],
				variants: [
					{ name: "A", config: null },
					{ name: "B", config: null },
				],
				audience: null,
				audienceStrict: false,
				customFieldValues: null,
				holdoutType: "full",
				...over,
			});

			it("variableValue() returns the control-variant value (not the caller default) for a held-out unit, and still fires the holdout's own exposure", () => {
				const response = buildHoldoutResponse([holdoutVarExperiment({})], [alwaysHoldsOut({})]);
				const context = new Context(sdk, contextOptions, contextParams, response);

				expect(context.treatment("exp_holdout_var")).toEqual(0);
				expect(context.variableValue("button.color", "APP_FALLBACK")).toEqual("CONTROL_GREY");
				expect(context.pending()).toEqual(1);
			});

			it("peekVariableValue() returns the control-variant value for a held-out unit without triggering any exposure", () => {
				const response = buildHoldoutResponse([holdoutVarExperiment({})], [alwaysHoldsOut({})]);
				const context = new Context(sdk, contextOptions, contextParams, response);

				expect(context.peekVariableValue("button.color", "APP_FALLBACK")).toEqual("CONTROL_GREY");
				expect(context.pending()).toEqual(0);
			});

			it("a genuinely assigned experiment still wins variable-key resolution over a suppressed one sharing the same key", () => {
				const winningExperiment = {
					id: 2,
					name: "exp_holdout_var_winner",
					iteration: 1,
					unitType: "session_id",
					seedHi: 300,
					seedLo: 400,
					split: [0, 1],
					trafficSeedHi: 1,
					trafficSeedLo: 2,
					trafficSplit: [0, 1],
					fullOnVariant: 1,
					applications: [{ name: "website" }],
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: JSON.stringify({ "button.color": "WINNER_BLUE" }) },
					],
					audience: null,
					audienceStrict: false,
					customFieldValues: null,
				};

				const response = buildHoldoutResponse([holdoutVarExperiment({}), winningExperiment], [alwaysHoldsOut({})]);
				const context = new Context(sdk, contextOptions, contextParams, response);

				expect(context.variableValue("button.color", "APP_FALLBACK")).toEqual("WINNER_BLUE");
			});

			it("returns the caller default when every candidate for the key is suppressed but none defines the key on its held-out variant", () => {
				const noKeyOnControlExperiment = holdoutVarExperiment({
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: JSON.stringify({ "button.color": "TREATMENT_GREEN" }) },
					],
				});

				const response = buildHoldoutResponse([noKeyOnControlExperiment], [alwaysHoldsOut({})]);
				const context = new Context(sdk, contextOptions, contextParams, response);

				expect(context.variableValue("button.color", "APP_FALLBACK")).toEqual("APP_FALLBACK");
			});

			// Ported from java's getVariableAssignment (Context.java:1362-1364): java pins the whole
			// first-encountered suppressed Assignment as the fallback and only checks the key on it
			// afterwards — it never skips past a suppressed candidate lacking the key to consider a
			// later one that has it. An earlier suppressed candidate without the key must produce the
			// caller's default, not a later suppressed candidate's value.
			it("an earlier suppressed candidate without the key blocks a later suppressed candidate that has it (java's ordering)", () => {
				const firstSuppressed = holdoutVarExperiment({
					id: 1,
					name: "exp_holdout_var_first",
					// Held out -> forced to variant 0 (control), which does NOT define the key.
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: JSON.stringify({ "button.color": "FIRST_TREATMENT" }) },
					],
				});

				const secondSuppressed = holdoutVarExperiment({
					id: 2,
					name: "exp_holdout_var_second",
					// Held out -> forced to variant 0 (control), which DOES define the key.
					variants: [
						{ name: "A", config: JSON.stringify({ "button.color": "SECOND_CONTROL" }) },
						{ name: "B", config: null },
					],
				});

				const response = buildHoldoutResponse([firstSuppressed, secondSuppressed], [alwaysHoldsOut({})]);
				const context = new Context(sdk, contextOptions, contextParams, response);

				expect(context.variableValue("button.color", "APP_FALLBACK")).toEqual("APP_FALLBACK");
			});

			// A throwing eventLogger for one candidate's exposure is isolated by _logEvent (it never
			// propagates), so it must not stop the loop from visiting (and firing exposures for) the
			// remaining candidates sharing the key.
			it("a throwing eventLogger for one candidate does not stop later candidates in the loop from being visited and exposed", () => {
				const firstExperiment = holdoutVarExperiment({
					id: 1,
					name: "exp_holdout_var_throw_first",
					holdoutIds: [11],
				});

				const secondExperiment = holdoutVarExperiment({
					id: 2,
					name: "exp_holdout_var_throw_second",
					holdoutIds: [12],
				});

				const secondHoldout = alwaysHoldsOut({ id: 12, name: "holdout_var_second" });

				const eventLogger = jest.fn((ctx, eventName, data) => {
					if (eventName === "exposure" && data.name === "holdout_var") {
						throw new Error("boom");
					}
				});

				const response = buildHoldoutResponse([firstExperiment, secondExperiment], [alwaysHoldsOut({}), secondHoldout]);
				const context = new Context(sdk, { ...contextOptions, eventLogger }, contextParams, response);

				expect(() => context.variableValue("button.color", "APP_FALLBACK")).not.toThrow();

				const exposureCalls = eventLogger.mock.calls.filter((c) => c[1] === "exposure");
				expect(exposureCalls.map((c) => c[2].name).sort()).toEqual(["holdout_var", "holdout_var_second"].sort());
			});

			// peekVariableValue() never triggers exposures, so its suppressedFallback ordering is tested separately.
			it("peekVariableValue(): an earlier suppressed candidate without the key blocks a later suppressed candidate that has it", () => {
				const firstSuppressed = holdoutVarExperiment({
					id: 1,
					name: "exp_holdout_var_peek_first",
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: JSON.stringify({ "button.color": "FIRST_TREATMENT" }) },
					],
				});

				const secondSuppressed = holdoutVarExperiment({
					id: 2,
					name: "exp_holdout_var_peek_second",
					variants: [
						{ name: "A", config: JSON.stringify({ "button.color": "SECOND_CONTROL" }) },
						{ name: "B", config: null },
					],
				});

				const response = buildHoldoutResponse([firstSuppressed, secondSuppressed], [alwaysHoldsOut({})]);
				const context = new Context(sdk, contextOptions, contextParams, response);

				expect(context.peekVariableValue("button.color", "APP_FALLBACK")).toEqual("APP_FALLBACK");
				expect(context.pending()).toEqual(0);
			});

			// A throwing eventLogger for an earlier candidate's exposure is isolated by _logEvent, so
			// a later candidate that genuinely wins must still resolve normally and still fire its own
			// exposure.
			it("resolves to a later winning candidate's value even after an earlier candidate's exposure logger throws", () => {
				const suppressedFirst = holdoutVarExperiment({
					id: 1,
					name: "exp_holdout_var_winner_after_throw",
					holdoutIds: [11],
				});

				const winningSecond = {
					id: 2,
					name: "exp_holdout_var_winner_after_throw_2",
					iteration: 1,
					unitType: "session_id",
					seedHi: 300,
					seedLo: 400,
					split: [0, 1],
					trafficSeedHi: 1,
					trafficSeedLo: 2,
					trafficSplit: [0, 1],
					fullOnVariant: 1,
					applications: [{ name: "website" }],
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: JSON.stringify({ "button.color": "WINNER_AFTER_THROW" }) },
					],
					audience: null,
					audienceStrict: false,
					customFieldValues: null,
				};

				const eventLogger = jest.fn((ctx, eventName, data) => {
					if (eventName === "exposure" && data.name === "holdout_var") {
						throw new Error("boom");
					}
				});

				const response = buildHoldoutResponse([suppressedFirst, winningSecond], [alwaysHoldsOut({})]);
				const context = new Context(sdk, { ...contextOptions, eventLogger }, contextParams, response);

				expect(context.variableValue("button.color", "APP_FALLBACK")).toEqual("WINNER_AFTER_THROW");

				const exposureCalls = eventLogger.mock.calls.filter((c) => c[1] === "exposure");
				expect(exposureCalls.map((c) => c[2].name)).toContain("exp_holdout_var_winner_after_throw_2");
			});

			// java's override write path never sets `suppressed` at all (see Assignment.suppressed's
			// doc comment), so an override can never become java's suppressedFallback. The JS port
			// pins `suppressed` eagerly on the override path too, so the fallback capture must
			// explicitly exclude overridden assignments to reproduce the same outcome — otherwise an
			// override to a variant that happens to omit the requested key could win the fallback
			// slot ahead of a genuinely suppressed sibling that actually defines it.
			it("excludes an overridden assignment from the suppressedFallback even when it is also held out", () => {
				const overriddenExperiment = {
					id: 1,
					name: "exp_holdout_var_overridden",
					iteration: 1,
					unitType: "session_id",
					seedHi: 100,
					seedLo: 200,
					split: [0.5, 0.5],
					trafficSeedHi: 1,
					trafficSeedLo: 2,
					trafficSplit: [0, 1],
					fullOnVariant: 0,
					applications: [{ name: "website" }],
					variants: [
						// Override target (variant 0) omits the key, so this candidate can't win
						// outright, and must not be allowed to claim the fallback slot either.
						{ name: "A", config: null },
						{ name: "B", config: JSON.stringify({ "button.color": "OVERRIDE_SIBLING" }) },
					],
					audience: null,
					audienceStrict: false,
					customFieldValues: null,
					holdoutIds: [11],
				};

				const genuinelySuppressedExperiment = {
					id: 2,
					name: "exp_holdout_var_genuinely_suppressed",
					iteration: 1,
					unitType: "session_id",
					seedHi: 300,
					seedLo: 400,
					split: [0.5, 0.5],
					trafficSeedHi: 1,
					trafficSeedLo: 2,
					trafficSplit: [0, 1],
					fullOnVariant: 0,
					applications: [{ name: "website" }],
					variants: [
						{ name: "A", config: JSON.stringify({ "button.color": "GENUINE_SUPPRESSED_CTRL" }) },
						{ name: "B", config: null },
					],
					audience: null,
					audienceStrict: false,
					customFieldValues: null,
					holdoutIds: [12],
				};

				const secondHoldout = alwaysHoldsOut({ id: 12, name: "holdout_var_second" });

				const response = buildHoldoutResponse(
					[overriddenExperiment, genuinelySuppressedExperiment],
					[alwaysHoldsOut({}), secondHoldout]
				);
				const context = new Context(sdk, contextOptions, contextParams, response);
				context.override("exp_holdout_var_overridden", 0);

				expect(context.variableValue("button.color", "APP_FALLBACK")).toEqual("GENUINE_SUPPRESSED_CTRL");
			});

			// _peekVariable never triggers exposures, so its override-exclusion guard is tested separately.
			it("peekVariableValue(): excludes an overridden assignment from the suppressedFallback even when it is also held out", () => {
				const overriddenExperiment = {
					id: 1,
					name: "exp_holdout_var_peek_overridden",
					iteration: 1,
					unitType: "session_id",
					seedHi: 100,
					seedLo: 200,
					split: [0.5, 0.5],
					trafficSeedHi: 1,
					trafficSeedLo: 2,
					trafficSplit: [0, 1],
					fullOnVariant: 0,
					applications: [{ name: "website" }],
					variants: [
						{ name: "A", config: null },
						{ name: "B", config: JSON.stringify({ "button.color": "OVERRIDE_SIBLING" }) },
					],
					audience: null,
					audienceStrict: false,
					customFieldValues: null,
					holdoutIds: [11],
				};

				const genuinelySuppressedExperiment = {
					id: 2,
					name: "exp_holdout_var_peek_genuinely_suppressed",
					iteration: 1,
					unitType: "session_id",
					seedHi: 300,
					seedLo: 400,
					split: [0.5, 0.5],
					trafficSeedHi: 1,
					trafficSeedLo: 2,
					trafficSplit: [0, 1],
					fullOnVariant: 0,
					applications: [{ name: "website" }],
					variants: [
						{ name: "A", config: JSON.stringify({ "button.color": "GENUINE_SUPPRESSED_CTRL" }) },
						{ name: "B", config: null },
					],
					audience: null,
					audienceStrict: false,
					customFieldValues: null,
					holdoutIds: [12],
				};

				const secondHoldout = alwaysHoldsOut({ id: 12, name: "holdout_var_peek_second" });

				const response = buildHoldoutResponse(
					[overriddenExperiment, genuinelySuppressedExperiment],
					[alwaysHoldsOut({}), secondHoldout]
				);
				const context = new Context(sdk, contextOptions, contextParams, response);
				context.override("exp_holdout_var_peek_overridden", 0);

				expect(context.peekVariableValue("button.color", "APP_FALLBACK")).toEqual("GENUINE_SUPPRESSED_CTRL");
				expect(context.pending()).toEqual(0);
			});
		});
	});

	describe("publish()/finalize() hardening", () => {
		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			publisher.publish.mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			context.finalize().then(() => {
				expect(() => context.publish()).toThrow();

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.publish()).toThrow();
		});

		it("should not restore or resend an already-delivered batch when a custom eventLogger throws on the publish success event", (done) => {
			const observerError = new Error("eventLogger failure");
			const throwingEventLogger = jest.fn((_, eventName) => {
				if (eventName === "publish") {
					throw observerError;
				}
			});

			const context = new Context(
				sdk,
				{ ...contextOptions, eventLogger: throwingEventLogger },
				contextParams,
				getContextResponse
			);

			context.track("goal1", { amount: 125 });
			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

			context.publish().then(() => {
				// The batch was already delivered successfully; the observer's throw
				// must not be treated as a publish failure that restores the queue
				// and resends the batch on the next flush.
				expect(context.pending()).toEqual(0);
				expect(consoleErrorSpy).toHaveBeenCalledWith(observerError);

				publisher.publish.mockClear();

				context.publish().then(() => {
					expect(publisher.publish).not.toHaveBeenCalled();

					consoleErrorSpy.mockRestore();
					done();
				});
			});
		});

		it("should still settle finalize() when a custom eventLogger throws while discarding events after failed initialization", (done) => {
			// The constructor's own ready-rejection handler also calls the
			// eventLogger with "error" — only start throwing after that call, so
			// this isolates the discard path inside _flush()/_finalize().
			const throwingEventLogger = jest.fn((_, eventName) => {
				if (eventName === "error" && throwingEventLogger.mock.calls.length > 1) {
					throw new Error("eventLogger boom on error");
				}
			});

			const context = new Context(
				sdk,
				{ ...contextOptions, eventLogger: throwingEventLogger },
				contextParams,
				Promise.reject("bad request error text")
			);

			context.ready().then(() => {
				context.treatment("exp_test_ab");
				expect(context.pending()).toEqual(1);

				const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

				// Discarding queued events after a failed init must still settle
				// finalize() (and clear the queue) even when the eventLogger throws —
				// otherwise `_finalizing` is left referencing a promise that never
				// resolves or rejects.
				context.finalize().then(() => {
					expect(publisher.publish).not.toHaveBeenCalled();
					expect(context.pending()).toEqual(0);
					expect(context.isFinalizing()).toEqual(false);
					expect(context.isFinalized()).toEqual(true);
					expect(consoleErrorSpy).toHaveBeenCalled();

					consoleErrorSpy.mockRestore();
					done();
				});
			});
		});

		it("should return completed promise when already finalized", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.treatment("exp_test_ab");

			publisher.publish.mockReturnValue(Promise.resolve());

			context.finalize().then(() => {
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);

				context.finalize().then(() => {
					done();
				});
			});
		});

		it("should cancel refresh timer", (done) => {
			jest.useFakeTimers("legacy");
			jest.spyOn(global, "setInterval");
			jest.spyOn(global, "clearInterval");

			const refreshPeriod = 1000;
			const context = new Context(
				sdk,
				Object.assign(contextOptions, { refreshPeriod }),
				contextParams,
				getContextResponse
			);

			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			expect(setInterval).toHaveBeenCalledTimes(1);
			expect(setInterval).toHaveBeenCalledWith(expect.anything(), refreshPeriod);
			const timerId = setInterval.mock.results[0].value;

			context.finalize().then(() => {
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);

				expect(clearInterval).toHaveBeenCalledTimes(1);
				expect(clearInterval).toHaveBeenCalledWith(timerId);

				done();
			});
		});

		it("should not finalize while a concurrent publish() is still in flight", (done) => {
			jest.useRealTimers();

			const context = new Context(
				sdk,
				{ ...contextOptions, publishDelay: -1, refreshPeriod: 0 },
				contextParams,
				getContextResponse
			);

			context.treatment("exp_test_ab");
			expect(context.pending()).toEqual(1);

			let resolvePublish;
			publisher.publish.mockReturnValue(
				new Promise((resolve) => {
					resolvePublish = resolve;
				})
			);

			const publishPromise = context.publish();

			// publish() has already reset the internal queue synchronously, so a
			// naive pending()-based check would see an empty queue here even though
			// the request has not settled yet.
			expect(context.pending()).toEqual(0);

			const finalizePromise = context.finalize();

			// finalize() must not complete (or mark the context finalized) while the
			// in-flight publish it is racing against hasn't settled.
			expect(context.isFinalized()).toEqual(false);
			expect(context.isFinalizing()).toEqual(true);

			// Give any (incorrect) synchronous finalize path a chance to run before
			// resolving the in-flight publish.
			Promise.resolve()
				.then(() => Promise.resolve())
				.then(() => Promise.resolve())
				.then(() => {
					expect(context.isFinalized()).toEqual(false);
					expect(publisher.publish).toHaveBeenCalledTimes(1);

					resolvePublish();

					return Promise.all([publishPromise, finalizePromise]);
				})
				.then(() => {
					expect(context.isFinalized()).toEqual(true);
					expect(context.isFinalizing()).toEqual(false);
					expect(context.pending()).toEqual(0);
					// finalize() waited on the same in-flight publish instead of
					// triggering a second, redundant request.
					expect(publisher.publish).toHaveBeenCalledTimes(1);

					done();
				});
		});

		it("should restore the queue and reject when the publisher throws synchronously", (done) => {
			const context = new Context(
				sdk,
				{ ...contextOptions, publishDelay: -1, refreshPeriod: 0 },
				contextParams,
				getContextResponse
			);

			context.treatment("exp_test_ab");
			expect(context.pending()).toEqual(1);

			const syncError = new Error("synchronous publisher failure");
			publisher.publish.mockImplementation(() => {
				throw syncError;
			});

			context.publish().catch((e) => {
				expect(e).toBe(syncError);
				// The snapshot taken before the (synchronously throwing) publish call
				// must be restored so the events are retried on the next flush.
				expect(context.pending()).toEqual(1);

				done();
			});
		});

		it("should not brick finalize() when a custom publisher returns a non-Promise value", (done) => {
			const context = new Context(
				sdk,
				{ ...contextOptions, publishDelay: -1, refreshPeriod: 0 },
				contextParams,
				getContextResponse
			);

			context.treatment("exp_test_ab");
			expect(context.pending()).toEqual(1);

			// A beacon-style or misimplemented custom publisher that forgets to
			// return a promise (e.g. `navigator.sendBeacon`-style success flag).
			publisher.publish.mockReturnValue(true);

			context.finalize().then(() => {
				expect(context.pending()).toEqual(0);
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);

				done();
			});
		});

		it("should restore a failed batch ahead of events recorded during the in-flight publish, preserving chronological order", (done) => {
			const context = new Context(
				sdk,
				{ ...contextOptions, publishDelay: -1, refreshPeriod: 0 },
				contextParams,
				getContextResponse
			);

			context.track("old_goal");
			expect(context.pending()).toEqual(1);

			let rejectFirst;
			publisher.publish.mockReturnValueOnce(
				new Promise((resolve, reject) => {
					rejectFirst = reject;
				})
			);

			const firstPublish = context.publish();

			// Record a newer event while the first publish is still in flight (its
			// snapshot was already taken and _goals/_exposures were reset).
			context.track("new_goal");

			rejectFirst(new Error("transport failed"));

			firstPublish.catch((e) => {
				expect(e.message).toEqual("transport failed");
				expect(context.pending()).toEqual(2);

				publisher.publish.mockReturnValueOnce(Promise.resolve());

				context.publish().then(() => {
					const retryRequest = publisher.publish.mock.calls[1][0];
					// The restored (older) batch must come before the newer event, not
					// after it — otherwise the collector sees goals out of chronological
					// order.
					expect(retryRequest.goals.map((g) => g.name)).toEqual(["old_goal", "new_goal"]);

					done();
				});
			});
		});

		it("should clear isFinalizing() and allow a retry after a synchronously throwing publisher", (done) => {
			const context = new Context(
				sdk,
				{ ...contextOptions, publishDelay: -1, refreshPeriod: 0 },
				contextParams,
				getContextResponse
			);

			context.treatment("exp_test_ab");
			expect(context.pending()).toEqual(1);

			const syncError = new Error("synchronous publisher failure");
			publisher.publish.mockImplementationOnce(() => {
				throw syncError;
			});

			context.finalize().catch((e) => {
				expect(e).toBe(syncError);
				// A `finalize()` callback that fires synchronously (as it does here,
				// since the publisher throws before any microtask boundary) must not
				// leave isFinalizing() stuck true — otherwise the context can never
				// finalize or retry.
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(false);
				expect(context.pending()).toEqual(1);

				publisher.publish.mockReturnValue(Promise.resolve());

				context.finalize().then(() => {
					expect(context.isFinalizing()).toEqual(false);
					expect(context.isFinalized()).toEqual(true);
					expect(context.pending()).toEqual(0);
					expect(publisher.publish).toHaveBeenCalledTimes(2);

					done();
				});
			});
		});

		it("should settle the finalize() promise even when a custom eventLogger throws on the finalize event", (done) => {
			const throwingEventLogger = jest.fn((_, eventName) => {
				if (eventName === "finalize") {
					throw new Error("eventLogger boom on finalize");
				}
			});

			const context = new Context(
				sdk,
				{ ...contextOptions, publishDelay: -1, refreshPeriod: 0, eventLogger: throwingEventLogger },
				contextParams,
				getContextResponse
			);

			context.treatment("exp_test_ab");
			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

			// A throwing eventLogger on the "finalize" event must not prevent
			// finalize() from resolving, or leave isFinalizing()/isFinalized() stuck.
			context.finalize().then(() => {
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);
				expect(consoleErrorSpy).toHaveBeenCalled();

				consoleErrorSpy.mockRestore();
				done();
			});
		});

		it("should not get stuck when a custom eventLogger throws on the error event during finalize()", (done) => {
			const throwingEventLogger = jest.fn((_, eventName) => {
				if (eventName === "error") {
					throw new Error("eventLogger boom on error");
				}
			});

			const context = new Context(
				sdk,
				{ ...contextOptions, publishDelay: -1, refreshPeriod: 0, eventLogger: throwingEventLogger },
				contextParams,
				getContextResponse
			);

			context.treatment("exp_test_ab");
			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.reject(new Error("transport failed")));

			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

			context.finalize().catch((e) => {
				expect(e.message).toEqual("transport failed");
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(false);
				expect(context.pending()).toEqual(1);
				expect(consoleErrorSpy).toHaveBeenCalled();

				publisher.publish.mockReturnValue(Promise.resolve());

				context.finalize().then(() => {
					expect(context.isFinalized()).toEqual(true);

					consoleErrorSpy.mockRestore();
					done();
				});
			});
		});

		it("should keep a failed scheduled batch pending until another event schedules a flush", (done) => {
			jest.useFakeTimers("legacy");
			jest.spyOn(global, "setTimeout");

			const publishDelay = 100;
			const context = new Context(
				sdk,
				{ ...contextOptions, publishDelay, refreshPeriod: 0 },
				contextParams,
				getContextResponse
			);

			context.treatment("exp_test_ab");
			expect(context.pending()).toEqual(1);
			expect(setTimeout).toHaveBeenCalledTimes(1);

			publisher.publish.mockReturnValueOnce(Promise.reject(new Error("network error")));

			jest.advanceTimersByTime(publishDelay);

			Promise.resolve()
				.then(() => Promise.resolve())
				.then(() => {
					expect(context.pending()).toEqual(1);
					expect(setTimeout).toHaveBeenCalledTimes(1);
					expect(publisher.publish).toHaveBeenCalledTimes(1);

					context.track("goal1");
					expect(context.pending()).toEqual(2);
					expect(setTimeout).toHaveBeenCalledTimes(2);

					publisher.publish.mockReturnValueOnce(Promise.resolve());
					jest.advanceTimersByTime(publishDelay);

					return Promise.resolve().then(() => Promise.resolve());
				})
				.then(() => {
					expect(context.pending()).toEqual(0);
					expect(publisher.publish).toHaveBeenCalledTimes(2);

					done();
				});
		});
	});
});
