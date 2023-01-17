import Client from "../client";
import SDK from "../sdk";
import Context from "../context";
import { hashUnit } from "../utils";
import clone from "rfdc/default";
import { ContextPublisher } from "../publisher";
import { ContextDataProvider } from "../provider";

jest.mock("../client");
jest.mock("../sdk");
jest.mock("../provider");
jest.mock("../publisher");

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
				audience: "{}",
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
				audience: "null",
			},
		],
	};

	const refreshContextResponse = Object.assign({}, getContextResponse, {
		experiments: [
			{
				id: 5,
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
	};

	const variableExperiments = {
		"banner.border": ["exp_test_ab"],
		"banner.size": ["exp_test_ab"],
		"button.color": ["exp_test_abc"],
		"card.width": ["exp_test_not_eligible"],
		"submit.color": ["exp_test_fullon"],
		"submit.shape": ["exp_test_fullon"],
		"show-modal": ["exp_test_new"],
	};

	const sdk = new SDK();
	const client = new Client();
	const publisher = new ContextPublisher();
	const provider = new ContextDataProvider();

	sdk.getContextDataProvider.mockReturnValue(provider);
	sdk.getContextPublisher.mockReturnValue(publisher);
	sdk.getClient.mockReturnValue(client);
	sdk.getEventLogger.mockReturnValue(SDK.defaultEventLogger);

	const contextOptions = {
		publishDelay: -1,
		refreshPeriod: 0,
	};

	const timeOrigin = 1611141535729;

	beforeEach(() => {
		jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);
	});

	describe("Context", () => {
		it("should be ready with data", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(getContextResponse);
				expect(context.eventLogger()).toBe(SDK.defaultEventLogger);
				expect(context.provider()).toBe(provider);
				expect(context.publisher()).toBe(publisher);

				done();
			});
		});

		it("should use custom publisher, dataProvider and eventLogger", (done) => {
			const customPublisher = new ContextPublisher();
			const customDataProvider = new ContextDataProvider();
			const customEventLogger = jest.fn();

			const context = new Context(
				sdk,
				{
					...contextOptions,
					publisher: customPublisher,
					dataProvider: customDataProvider,
					eventLogger: customEventLogger,
				},
				contextParams,
				getContextResponse
			);
			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(getContextResponse);
				expect(context.eventLogger()).toBe(customEventLogger);
				expect(context.provider()).toBe(customDataProvider);
				expect(context.publisher()).toBe(customPublisher);

				done();
			});
		});

		it("should become ready and call handler", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(getContextResponse);
				expect(context.eventLogger()).toBe(SDK.defaultEventLogger);
				expect(context.provider()).toBe(provider);
				expect(context.publisher()).toBe(publisher);

				done();
			});
		});

		it("should become ready and failed, and call handler on failure", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text"));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.isFailed()).toEqual(true);
				expect(context.data()).toStrictEqual({});
				expect(context.eventLogger()).toBe(SDK.defaultEventLogger);
				expect(context.provider()).toBe(provider);
				expect(context.publisher()).toBe(publisher);

				done();
			});
		});

		it("should call event logger on error", (done) => {
			SDK.defaultEventLogger.mockClear();

			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text"));
			context.ready().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "error", "bad request error text");

				done();
			});
		});

		it("should call event logger on success", (done) => {
			SDK.defaultEventLogger.mockClear();

			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));
			context.ready().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "ready", getContextResponse);

				done();
			});
		});

		it("should call event logger on pre-fetched experiment data", (done) => {
			SDK.defaultEventLogger.mockClear();

			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			context.ready().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "ready", getContextResponse);

				done();
			});
		});

		it("should throw when not ready", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			expect(() => context.data()).toThrow();
			expect(() => context.treatment("test")).toThrow();
			expect(() => context.peek("test")).toThrow();
			expect(() => context.experiments()).toThrow();
			expect(() => context.variableKeys()).toThrow();
			expect(() => context.variableValue("a", 17)).toThrow();
			expect(() => context.peekVariableValue("a", 17)).toThrow();

			done();
		});

		it("should load experiment data", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			expect(context.experiments()).toEqual(getContextResponse.experiments.map((x) => x.name));
			for (const experiment of getContextResponse.experiments) {
				expect(context.peek(experiment.name)).toEqual(expectedVariants[experiment.name]);
				expect(context.treatment(experiment.name)).toEqual(expectedVariants[experiment.name]);
			}
			expect(context.data()).toEqual(getContextResponse);

			done();
		});

		it("should start refresh timer after ready", (done) => {
			jest.useFakeTimers("legacy");
			jest.spyOn(global, "setInterval");

			const refreshPeriod = 1000;
			const context = new Context(
				sdk,
				Object.assign(contextOptions, { refreshPeriod }),
				contextParams,
				Promise.resolve(getContextResponse)
			);

			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			expect(setInterval).not.toHaveBeenCalled();

			context.ready().then(() => {
				expect(setInterval).toHaveBeenCalledTimes(1);
				expect(setInterval).toHaveBeenCalledWith(expect.anything(), refreshPeriod);
				setInterval.mockClear();

				jest.advanceTimersByTime(refreshPeriod - 1);

				expect(provider.getContextData).not.toHaveBeenCalled();

				const getContextPromise = Promise.resolve(refreshContextResponse);
				provider.getContextData.mockReturnValue(getContextPromise);

				jest.advanceTimersByTime(refreshPeriod);

				getContextPromise.then(() => {
					expect(setInterval).not.toHaveBeenCalled();
					expect(provider.getContextData).toHaveBeenCalledTimes(1);
					expect(provider.getContextData).toHaveBeenCalledWith(sdk, undefined);
					provider.getContextData.mockClear();

					// test another interval
					const nextGetContextPromise = Promise.resolve(refreshContextResponse);
					provider.getContextData.mockReturnValue(nextGetContextPromise);

					jest.advanceTimersByTime(refreshPeriod);
					nextGetContextPromise.then(() => {
						expect(setInterval).not.toHaveBeenCalled();
						expect(provider.getContextData).toHaveBeenCalledTimes(1);
						expect(provider.getContextData).toHaveBeenCalledWith(sdk, undefined);

						done();
					});
				});
			});
		});
	});

	describe("unit()", () => {
		it("should set a unit", (done) => {
			const context = new Context(sdk, contextOptions, { units: {} }, getContextResponse);

			context.units(units);

			for (const [key, value] of Object.entries(units)) {
				expect(context.getUnit(key)).toEqual(value);
			}

			expect(context.getUnits()).toEqual(units);

			done();
		});
		it("should throw on duplicate unit type set", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.isReady()).toEqual(true);

			expect(() => context.unit("session_id", "new_id")).toThrow();

			// should not throw if set to the same value
			expect(() => context.unit("session_id", "e791e240fcd3df7d238cfc285f475e8152fcc0ec")).not.toThrow();

			done();
		});

		it("should throw on invalid uid", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.isReady()).toEqual(true);

			expect(() => context.unit("session_id", "")).toThrow();
			expect(() => context.unit("session_id", null)).toThrow();
			expect(() => context.unit("session_id", undefined)).toThrow();
			expect(() => context.unit("session_id", true)).toThrow();
			expect(() => context.unit("session_id", {})).toThrow();
			expect(() => context.unit("session_id", [])).toThrow();

			done();
		});

		it("should be callable before ready()", (done) => {
			const context = new Context(sdk, contextOptions, {}, Promise.resolve(getContextResponse));

			context.units(contextParams.units);

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);

				context.treatment("exp_test_ab");

				publisher.publish.mockReturnValue(Promise.resolve());

				jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

				context.publish().then(() => {
					expect(publisher.publish).toHaveBeenCalledTimes(1);
					expect(publisher.publish).toHaveBeenCalledWith(
						{
							publishedAt: 1611141535829,
							units: publishUnits,
							hashed: true,
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

					done();
				});
			});
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			publisher.publish.mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			context.finalize().then(() => {
				expect(() => context.unit("test", "test")).toThrow(); // finalizing

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.unit("test", "test")).toThrow(); // finalizing
		});
	});

	describe("getAttribute()", () => {
		it("should get the last set attribute", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.attribute("attr1", "value1");
			context.attribute("attr1", "value2");

			expect(context.getAttribute("attr1")).toEqual("value2");

			done();
		});
	});

	describe("attribute()", () => {
		it("should set an attribute", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

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

			done();
		});

		it("should be callable before ready()", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));
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

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);

				context.treatment("exp_test_ab");

				publisher.publish.mockReturnValue(Promise.resolve());

				jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

				context.publish().then(() => {
					expect(publisher.publish).toHaveBeenCalledTimes(1);
					expect(publisher.publish).toHaveBeenCalledWith(
						{
							publishedAt: 1611141535829,
							units: publishUnits,
							hashed: true,
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
								{
									name: "attr1",
									setAt: 1611141535729,
									value: "value1",
								},
								{
									name: "attr2",
									setAt: 1611141535729,
									value: "value2",
								},
								{
									name: "attr3",
									setAt: 1611141535729,
									value: 3,
								},
							],
						},
						sdk,
						context,
						undefined
					);

					done();
				});
			});
		});
	});

	describe("refresh()", () => {
		it("should call client and load new data", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			provider.getContextData.mockReturnValue(Promise.resolve(refreshContextResponse));

			context.refresh().then(() => {
				expect(provider.getContextData).toHaveBeenCalledTimes(1);
				expect(provider.getContextData).toHaveBeenCalledWith(sdk, undefined);

				expect(context.experiments()).toEqual(refreshContextResponse.experiments.map((x) => x.name));
				for (const experiment of refreshContextResponse.experiments) {
					expect(context.treatment(experiment.name)).toEqual(expectedVariants[experiment.name]);
				}
				expect(context.data()).toEqual(refreshContextResponse);

				done();
			});
		});

		it("should pass through request options", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			provider.getContextData.mockReturnValue(Promise.resolve(refreshContextResponse));

			context.refresh({ timeout: 1234 }).then(() => {
				expect(provider.getContextData).toHaveBeenCalledTimes(1);
				expect(provider.getContextData).toHaveBeenCalledWith(sdk, { timeout: 1234 });

				expect(context.experiments()).toEqual(refreshContextResponse.experiments.map((x) => x.name));
				for (const experiment of refreshContextResponse.experiments) {
					expect(context.treatment(experiment.name)).toEqual(expectedVariants[experiment.name]);
				}
				expect(context.data()).toEqual(refreshContextResponse);

				done();
			});
		});

		it("should reject promise on error", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			provider.getContextData.mockReturnValueOnce(Promise.reject(new Error("test error")));

			context.refresh().catch((error) => {
				expect(error.message).toEqual("test error");
				done();
			});
		});

		it("should not re-queue exposures after refresh when not changed", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			provider.getContextData.mockReturnValue(Promise.resolve(refreshContextResponse));

			context.refresh().then(() => {
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

				done();
			});
		});

		it("should not re-queue when not changed on audience mismatch", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse);

			expect(context.treatment("exp_test_ab")).toEqual(0);

			expect(context.pending()).toEqual(1);

			provider.getContextData.mockReturnValue(Promise.resolve(audienceStrictContextResponse));

			context.refresh().then(() => {
				expect(context.treatment("exp_test_ab")).toEqual(0);

				expect(context.pending()).toEqual(1);

				done();
			});
		});

		it("should not re-queue when not changed with override", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse);

			context.override("exp_test_ab", 3);
			expect(context.treatment("exp_test_ab")).toEqual(3);

			expect(context.pending()).toEqual(1);

			provider.getContextData.mockReturnValue(Promise.resolve(audienceStrictContextResponse));

			context.refresh().then(() => {
				expect(context.treatment("exp_test_ab")).toEqual(3);

				expect(context.pending()).toEqual(1);

				done();
			});
		});

		it("should not call client publish when failed", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text"));

			context.ready().then(() => {
				context.refresh().then(() => {
					expect(provider.getContextData).not.toHaveBeenCalled();

					done();
				});
			});
		});

		it("should call event logger when failed", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));
			context.ready().then(() => {
				provider.getContextData.mockReturnValueOnce(Promise.reject(new Error("test error")));

				SDK.defaultEventLogger.mockClear();
				context.refresh().catch((error) => {
					expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
					expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "error", error);

					done();
				});
			});
		});

		it("should call event logger on success", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));

			provider.getContextData.mockReturnValueOnce(Promise.resolve(refreshContextResponse));

			context.ready().then(() => {
				SDK.defaultEventLogger.mockClear();
				context.refresh().then(() => {
					expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
					expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "refresh", refreshContextResponse);

					done();
				});
			});
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			publisher.publish.mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			context.finalize().then(() => {
				expect(() => context.refresh()).toThrow();

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.refresh()).toThrow(); // finalizing
		});

		it("should keep overrides", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			provider.getContextData.mockReturnValue(Promise.resolve(refreshContextResponse));

			context.override("not_found", 3);
			expect(context.peek("not_found")).toEqual(3);

			context.refresh().then(() => {
				expect(context.peek("not_found")).toEqual(3);

				done();
			});
		});

		it("should keep custom assignments", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			provider.getContextData.mockReturnValue(Promise.resolve(refreshContextResponse));

			context.customAssignment("exp_test_ab", 3);

			expect(context.peek("exp_test_ab")).toEqual(3);

			context.refresh().then(() => {
				expect(context.peek("exp_test_ab")).toEqual(3);

				done();
			});
		});

		it("should pick up changes in experiment stopped", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			const experimentName = "exp_test_abc";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const stoppedRefreshContextResponse = clone(getContextResponse);
			stoppedRefreshContextResponse.experiments = stoppedRefreshContextResponse.experiments.filter(
				(x) => x.name !== experimentName
			);

			provider.getContextData.mockReturnValue(Promise.resolve(stoppedRefreshContextResponse));

			context.refresh().then(() => {
				expect(context.treatment(experimentName)).toEqual(0);
				expect(context.pending()).toEqual(2); // exposure before the change + exposure after stopped

				done();
			});
		});

		it("should pick up changes in experiment started", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			const experimentName = "exp_test_new";

			expect(context.treatment(experimentName)).toEqual(0);
			expect(context.pending()).toEqual(1);

			provider.getContextData.mockReturnValue(Promise.resolve(refreshContextResponse));

			context.refresh().then(() => {
				expect(context.treatment(experimentName)).toEqual(1);
				expect(context.pending()).toEqual(2); // exposure before the change + exposure after stopped

				done();
			});
		});

		it("should pick up changes in experiment fullon", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
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

			provider.getContextData.mockReturnValue(Promise.resolve(fullOnRefreshContextResponse));

			context.refresh().then(() => {
				expect(context.treatment(experimentName)).toEqual(1);
				expect(context.pending()).toEqual(2); // exposure before the change + exposure after fullon

				done();
			});
		});

		it("should pick up changes in experiment traffic split", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			const experimentName = "exp_test_not_eligible";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const scaledUpRefreshContextResponse = clone(getContextResponse);
			for (const experiment of scaledUpRefreshContextResponse.experiments) {
				if (experiment.name === experimentName) {
					experiment.trafficSplit = [0.0, 1.0];
				}
			}

			provider.getContextData.mockReturnValue(Promise.resolve(scaledUpRefreshContextResponse));

			context.refresh().then(() => {
				expect(context.treatment(experimentName)).toEqual(2);
				expect(context.pending()).toEqual(2); // exposure before the change + exposure after fullon

				done();
			});
		});

		it("should pick up changes in experiment iteration", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			const experimentName = "exp_test_abc";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const iteratedRefreshContextResponse = clone(getContextResponse);
			for (const experiment of iteratedRefreshContextResponse.experiments) {
				if (experiment.name === experimentName) {
					experiment.iteration = 2;
					experiment.trafficSeedHi = 54870830;
					experiment.trafficSeedHi = 398724581;
					experiment.seedHi = 77498863;
					experiment.seedHi = 34737352;
				}
			}

			provider.getContextData.mockReturnValue(Promise.resolve(iteratedRefreshContextResponse));

			context.refresh().then(() => {
				expect(context.treatment(experimentName)).toEqual(1);
				expect(context.pending()).toEqual(2); // exposure before the change + exposure after fullon

				done();
			});
		});

		it("should pick up changes in experiment id", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			const experimentName = "exp_test_abc";

			expect(context.treatment(experimentName)).toEqual(expectedVariants[experimentName]);
			expect(context.pending()).toEqual(1);

			const iteratedRefreshContextResponse = clone(getContextResponse);
			for (const experiment of iteratedRefreshContextResponse.experiments) {
				if (experiment.name === experimentName) {
					experiment.id = 11;
					experiment.trafficSeedHi = 54870830;
					experiment.trafficSeedHi = 398724581;
					experiment.seedHi = 77498863;
					experiment.seedHi = 34737352;
				}
			}

			provider.getContextData.mockReturnValue(Promise.resolve(iteratedRefreshContextResponse));

			context.refresh().then(() => {
				expect(context.treatment(experimentName)).toEqual(1);
				expect(context.pending()).toEqual(2); // exposure before the change + exposure after fullon

				done();
			});
		});
	});

	describe("peek()", () => {
		it("should not queue exposures", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				expect(context.peek(experiment.name)).toEqual(expectedVariants[experiment.name]);
			}

			expect(context.pending()).toEqual(0);

			done();
		});

		it("should return override variant", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
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

			done();
		});

		it("should return assigned variant on audience mismatch in non-strict mode", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse);

			expect(context.peek("exp_test_ab")).toEqual(1);

			done();
		});

		it("should return control variant on audience mismatch in strict mode", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse);

			expect(context.peek("exp_test_ab")).toEqual(0);

			done();
		});
	});

	describe("treatment()", () => {
		it("should queue exposures", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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
						],
					},
					sdk,
					context,
					undefined
				);

				done();
			});
		});

		it("should queue exposures after peek()", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				context.peek(experiment.name);
			}

			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			done();
		});

		it("should queue exposures only once", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			for (const experiment of getContextResponse.experiments) {
				context.treatment(experiment.name);
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			done();
		});

		it("should call event logger", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			for (const experiment of getContextResponse.experiments) {
				SDK.defaultEventLogger.mockClear();
				context.treatment(experiment.name);
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "exposure", {
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

			// check it calls logger only once
			for (const experiment of getContextResponse.experiments) {
				SDK.defaultEventLogger.mockClear();
				context.treatment(experiment.name);
				expect(SDK.defaultEventLogger).not.toHaveBeenCalled();
			}

			done();
		});

		it("should queue exposure with base variant on unknown/stopped experiment", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			expect(context.treatment("not_found")).toEqual(0);

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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

				done();
			});
		});

		it("should queue exposure with audienceMatch true on audience match", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse);
			context.attribute("age", 21);

			expect(context.treatment("exp_test_ab")).toEqual(1);

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
						attributes: [
							{
								name: "age",
								setAt: 1611141535729,
								value: 21,
							},
						],
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

				done();
			});
		});

		it("should queue exposure with audienceMatch false on audience mismatch", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse);

			expect(context.treatment("exp_test_ab")).toEqual(1);

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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

				done();
			});
		});

		it("should queue exposure with audienceMatch false and control variant on audience mismatch in strict mode", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse);

			expect(context.treatment("exp_test_ab")).toEqual(0);

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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

				done();
			});
		});

		it("should not re-queue exposure on unknown experiment", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			expect(context.pending()).toEqual(0);

			expect(context.treatment("not_found")).toEqual(0);

			expect(context.pending()).toEqual(1);

			expect(context.treatment("not_found")).toEqual(0);

			expect(context.pending()).toEqual(1);

			done();
		});

		it("should queue exposure with override variant", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			context.override("exp_test_ab", 5);
			context.override("not_found", 3);

			expect(context.treatment("exp_test_ab")).toEqual(5);
			expect(context.treatment("not_found")).toEqual(3);

			expect(context.pending()).toEqual(2);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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

				done();
			});
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			publisher.publish.mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			context.finalize().then(() => {
				expect(() => context.treatment("exp_test_ab")).toThrow();

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.treatment("exp_test_ab")).toThrow();
		});
	});

	describe("variableValue()", () => {
		it("conflicting key disjoint audiences", (done) => {
			const context1 = new Context(sdk, contextOptions, contextParams, disjointedContextResponse);
			const context2 = new Context(sdk, contextOptions, contextParams, disjointedContextResponse);

			expect(context1.pending()).toEqual(0);
			expect(context2.pending()).toEqual(0);

			expect(expectedVariants["exp_test_ab"]).not.toEqual(0);
			expect(expectedVariants["exp_test_abc"]).not.toEqual(0);

			context1.attribute("age", 20);
			expect(context1.variableValue("icon", "square")).toEqual("arrow");

			context2.attribute("age", 19);
			expect(context2.variableValue("icon", "square")).toEqual("circle");

			done();
		});
		it("should queue exposures", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			const experiments = context.experiments();

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				const actual = context.variableValue(key, 17);
				const eligible = experimentName !== "exp_test_not_eligible";

				if (eligible && experiments.indexOf(experimentName) !== -1) {
					expect(actual).toEqual(expectedVariables[key]);
				} else {
					expect(actual).toBe(17);
				}
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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
						],
					},
					sdk,
					context,
					undefined
				);

				done();
			});
		});

		it("should queue exposures after peekVariable()", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			const experiments = context.experiments();

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				const actual = context.peekVariableValue(key, 17);
				const eligible = experimentName !== "exp_test_not_eligible";

				if (eligible && experiments.indexOf(experimentName) !== -1) {
					expect(actual).toEqual(expectedVariables[key]);
				} else {
					expect(actual).toBe(17);
				}
			}

			expect(context.pending()).toEqual(0);

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				const actual = context.variableValue(key, 17);
				const eligible = experimentName !== "exp_test_not_eligible";

				if (eligible && experiments.indexOf(experimentName) !== -1) {
					expect(actual).toEqual(expectedVariables[key]);
				} else {
					expect(actual).toBe(17);
				}
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			done();
		});

		it("should queue exposures only once", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			const experiments = context.experiments();

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				const actual = context.variableValue(key, 17);
				const eligible = experimentName !== "exp_test_not_eligible";

				if (eligible && experiments.indexOf(experimentName) !== -1) {
					expect(actual).toEqual(expectedVariables[key]);
				} else {
					expect(actual).toBe(17);
				}
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				const actual = context.variableValue(key, 17);
				const eligible = experimentName !== "exp_test_not_eligible";

				if (eligible && experiments.indexOf(experimentName) !== -1) {
					expect(actual).toEqual(expectedVariables[key]);
				} else {
					expect(actual).toBe(17);
				}
			}

			expect(context.pending()).toEqual(getContextResponse.experiments.length);

			done();
		});

		it("should call event logger", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			const experiments = context.experiments();
			const exposed = {};

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				SDK.defaultEventLogger.mockClear();
				context.variableValue(key, 17);

				if (experiments.indexOf(experimentName) !== -1) {
					const experiment = getContextResponse.experiments.filter((x) => x.name === experimentName)[0];
					if (!(experimentName in exposed)) {
						exposed[experimentName] = true;
						expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
						expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "exposure", {
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
					} else {
						expect(SDK.defaultEventLogger).not.toHaveBeenCalled();
					}
				}
			}

			// check it calls logger only once
			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				SDK.defaultEventLogger.mockClear();
				context.variableValue(key, 17);
				if (experiments.indexOf(experimentName) !== -1) {
					expect(SDK.defaultEventLogger).not.toHaveBeenCalled();
				}
			}

			done();
		});

		it("should return defaultValue on unknown variable", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			expect(context.variableValue("not.found", 17)).toBe(17);

			done();
		});

		it("should queue exposure with audienceMatch true on audience match", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse);
			context.attribute("age", 21);

			expect(context.variableValue("banner.size", "small")).toEqual("large");

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
						attributes: [
							{
								name: "age",
								setAt: 1611141535729,
								value: 21,
							},
						],
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

				done();
			});
		});

		it("should queue exposure with audienceMatch false on audience mismatch", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse);

			expect(context.variableValue("banner.size", "small")).toEqual("large");

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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

				done();
			});
		});

		it("should queue exposure with audienceMatch false and control variant on audience mismatch in strict mode", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse);

			expect(context.variableValue("banner.size", "small")).toEqual("small");

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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

				done();
			});
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			publisher.publish.mockReturnValue(Promise.resolve());

			context.variableValue("button.color", 17);

			expect(context.pending()).toEqual(1);

			context.finalize().then(() => {
				expect(() => context.variableValue("button.color", 17)).toThrow();

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.variableValue("button.color", 17)).toThrow();
		});
	});

	describe("peekVariableValue()", () => {
		it("conflicting key disjoint audiences", (done) => {
			const context1 = new Context(sdk, contextOptions, contextParams, disjointedContextResponse);
			const context2 = new Context(sdk, contextOptions, contextParams, disjointedContextResponse);

			expect(context1.pending()).toEqual(0);
			expect(context2.pending()).toEqual(0);

			expect(expectedVariants["exp_test_ab"]).not.toEqual(0);
			expect(expectedVariants["exp_test_abc"]).not.toEqual(0);

			context1.attribute("age", 20);
			expect(context1.peekVariableValue("icon", "square")).toEqual("arrow");

			context2.attribute("age", 19);
			expect(context2.peekVariableValue("icon", "square")).toEqual("circle");

			expect(context1.pending()).toEqual(0);
			expect(context2.pending()).toEqual(0);

			done();
		});

		it("should pick lowest experiment id on conflicting key", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, lowestIdConflictingKeyContextResponse);

			expect(context.pending()).toEqual(0);

			expect(expectedVariants["exp_test_ab"]).not.toEqual(0);
			expect(expectedVariants["exp_test_abc"]).not.toEqual(0);

			expect(context.peekVariableValue("icon", "square")).toEqual("circle");

			done();
		});

		it("should not queue exposures", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			const experiments = context.experiments();

			for (const [key, experimentNames] of Object.entries(variableExperiments)) {
				const experimentName = experimentNames[0];
				const actual = context.peekVariableValue(key, 17);
				const eligible = experimentName !== "exp_test_not_eligible";

				if (eligible && experiments.indexOf(experimentName) !== -1) {
					expect(actual).toEqual(expectedVariables[key]);
				} else {
					expect(actual).toBe(17);
				}
			}

			expect(context.pending()).toEqual(0);

			done();
		});

		it("should return defaultValue on unknown override variant", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			for (const experiment of getContextResponse.experiments) {
				context.override(experiment.name, expectedVariants[experiment.name] + 11);
			}
			context.override("not_found", 3);

			for (const key of Object.keys(variableExperiments)) {
				const actual = context.peekVariableValue(key, 17);
				expect(actual).toBe(17);
			}

			expect(context.pending()).toEqual(0);

			done();
		});

		it("should return assigned variant on audience mismatch in non-strict mode", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceContextResponse);

			expect(context.peekVariableValue("banner.size", "small")).toEqual("large");

			done();
		});

		it("should return control variant on audience mismatch in strict mode", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, audienceStrictContextResponse);

			expect(context.peekVariableValue("banner.size", "small")).toEqual("small");

			done();
		});
	});

	describe("variableKeys()", () => {
		it("should return all active keys", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, refreshContextResponse);
			expect(context.pending()).toEqual(0);

			expect(context.variableKeys()).toMatchObject(variableExperiments);

			expect(context.pending()).toEqual(0);

			done();
		});
	});

	describe("track()", () => {
		it("should queue goals", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			context.track("goal1", { amount: 125, hours: 245 });
			context.track("goal2", { tries: 7 });

			expect(context.pending()).toEqual(2);

			context.track("goal2", { tests: 12 });

			expect(context.pending()).toEqual(3);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
						goals: [
							{
								achievedAt: 1611141535729,
								name: "goal1",
								properties: { amount: 125, hours: 245 },
							},
							{
								achievedAt: 1611141535729,
								name: "goal2",
								properties: { tries: 7 },
							},
							{
								achievedAt: 1611141535729,
								name: "goal2",
								properties: { tests: 12 },
							},
						],
					},
					sdk,
					context,
					undefined
				);

				done();
			});
		});

		it("should call event logger", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			SDK.defaultEventLogger.mockClear();
			context.track("goal1", { amount: 125, hours: 245 });
			expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "goal", {
				achievedAt: timeOrigin,
				name: "goal1",
				properties: { amount: 125, hours: 245 },
			});

			done();
		});

		it("should not throw when goal property values are numbers or objects with number values", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			expect(() => context.track("goal1", { test: { flt: 1.5, int: 2 } })).not.toThrowError();
			expect(() => context.track("goal1", { test: {} })).not.toThrowError();
			expect(() => context.track("goal1", { test: null })).not.toThrowError();

			expect(context.pending()).toEqual(3);

			done();
		});

		it("should not throw when goal properties is null or undefined", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			expect(() => context.track("goal1")).not.toThrowError();
			expect(() => context.track("goal1", null)).not.toThrowError();
			expect(() => context.track("goal1", undefined)).not.toThrowError();

			expect(context.pending()).toEqual(3);

			done();
		});

		it("should throw when goal properties not object", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			expect(() => context.track("goal1", 125.0)).toThrowError("Goal 'goal1' properties must be of type object.");
			expect(() => context.track("goal1", true)).toThrowError("Goal 'goal1' properties must be of type object.");
			expect(() => context.track("goal1", "testy")).toThrowError(
				"Goal 'goal1' properties must be of type object."
			);
			expect(() => context.track("goal1", [])).toThrowError("Goal 'goal1' properties must be of type object.");

			done();
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			publisher.publish.mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			context.finalize().then(() => {
				expect(() => context.track("payment", { amount: 125 })).toThrow();

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.track("payment", { amount: 125 })).toThrow();
		});

		it("should queue when not ready", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));
			expect(context.pending()).toEqual(0);
			expect(context.isReady()).toEqual(false);

			context.track("goal1", { amount: 125 });

			expect(context.pending()).toEqual(1);
			expect(context.isReady()).toEqual(false);

			context.ready().then(() => {
				expect(context.pending()).toEqual(1);

				done();
			});
		});

		it("should start timeout after ready if queue is not empty", (done) => {
			jest.useFakeTimers("legacy");
			jest.spyOn(global, "setTimeout");

			const publishDelay = 100;
			const context = new Context(
				sdk,
				Object.assign(contextOptions, { publishDelay }),
				contextParams,
				Promise.resolve(getContextResponse)
			);

			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			context.track("goal1", { amount: 125 });

			expect(context.pending()).toEqual(1);

			context.ready().then(() => {
				expect(setTimeout).toHaveBeenCalledTimes(1);
				expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

				jest.advanceTimersByTime(publishDelay - 1);

				expect(publisher.publish).not.toHaveBeenCalled();

				publisher.publish.mockReturnValue(Promise.resolve({}));

				jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

				jest.advanceTimersByTime(2);

				expect(publisher.publish).toHaveBeenCalledTimes(1);
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535829,
						units: publishUnits,
						hashed: true,
						goals: [
							{
								name: "goal1",
								achievedAt: 1611141535729,
								properties: { amount: 125 },
							},
						],
					},
					sdk,
					context,
					undefined
				);

				done();
			});
		});
	});

	describe("publish()", () => {
		it("should not call client publish when queue is empty", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).not.toHaveBeenCalled();
				done();
			});
		});

		it("should propagate client error message", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			context.track("goal1", { amount: 125 });

			publisher.publish.mockReturnValue(Promise.reject("test"));

			context.publish().catch((e) => {
				expect(e).toEqual("test");

				done();
			});
		});

		it("should call client publish", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.treatment("exp_test_ab");
			context.treatment("exp_test_not_eligible");

			Date.now.mockImplementation(() => timeOrigin + 1); // ensure that time is kept separately per event
			context.track("goal1", { amount: 125, hours: 245 });

			Date.now.mockImplementation(() => timeOrigin + 2);
			context.attribute("attr1", "value1");

			Date.now.mockImplementation(() => timeOrigin + 3);
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

			publisher.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledTimes(1);
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535829,
						units: publishUnits,
						hashed: true,
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
							{
								name: "attr1",
								setAt: 1611141535731,
								value: "value1",
							},
							{
								name: "attr2",
								setAt: 1611141535732,
								value: "value2",
							},
							{
								name: "attr3",
								setAt: 1611141535732,
								value: 3,
							},
							{
								name: "attr4",
								setAt: 1611141535732,
								value: 5.0,
							},
							{
								name: "attr5",
								setAt: 1611141535732,
								value: true,
							},
							{
								name: "attr6",
								setAt: 1611141535732,
								value: [1, 2, 3, 4],
							},
							{
								name: "attr7",
								setAt: 1611141535732,
								value: null,
							},
							{
								name: "attr8",
								setAt: 1611141535732,
								value: [],
							},
							{
								name: "attr9",
								setAt: 1611141535732,
								value: [null, 1, 2],
							},
							{
								name: "attr10",
								setAt: 1611141535732,
								value: ["one", null, "two"],
							},

							{
								name: "attr11",
								setAt: 1611141535732,
								value: [null, null],
							},
						],
					},
					sdk,
					context,
					undefined
				);

				expect(context.pending()).toEqual(0);

				done();
			});
		});

		it("should pass through request options", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.track("goal1", { amount: 125, hours: 245 });

			publisher.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context.publish({ timeout: 1234 }).then(() => {
				expect(publisher.publish).toHaveBeenCalledTimes(1);
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535829,
						units: publishUnits,
						hashed: true,
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
					{
						timeout: 1234,
					}
				);

				expect(context.pending()).toEqual(0);

				done();
			});
		});

		it("should call event logger on error", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.track("goal1", { amount: 125, hours: 245 });

			publisher.publish.mockReturnValue(Promise.reject("test error"));

			SDK.defaultEventLogger.mockClear();
			context.publish().catch((error) => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "error", error);

				done();
			});
		});

		it("should call event logger on success", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.track("goal1", { amount: 125, hours: 245 });

			publisher.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			SDK.defaultEventLogger.mockClear();
			context.publish().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "publish", {
					publishedAt: 1611141535829,
					units: publishUnits,
					hashed: true,
					goals: [
						{
							achievedAt: 1611141535729,
							name: "goal1",
							properties: { amount: 125, hours: 245 },
						},
					],
				});

				done();
			});
		});

		it("should not call client publish when failed", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text"));
			context.ready().then(() => {
				context.treatment("exp_test_ab");

				Date.now.mockImplementation(() => timeOrigin + 1); // ensure that time is kept separately per event
				context.track("goal1", { amount: 125, hours: 245 });

				expect(context.pending()).toEqual(2);

				context.publish().then(() => {
					expect(publisher.publish).not.toHaveBeenCalled();
					expect(context.pending()).toEqual(0);

					done();
				});
			});
		});

		it("should reset internal queues and keep attributes overrides and custom assignments", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.treatment("exp_test_ab");
			context.track("goal1", { amount: 125, hours: 245 });
			context.attribute("attr1", "value1");

			context.override("not_found", 3);
			expect(context.treatment("not_found")).toEqual(3);

			context.customAssignment("exp_test_abc", 3);
			expect(context.treatment("exp_test_abc")).toEqual(3);

			expect(context.pending()).toEqual(4);

			publisher.publish.mockReturnValue(Promise.resolve({}));

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context
				.publish()
				.then(() => {
					expect(publisher.publish).toHaveBeenCalledTimes(1);
					expect(publisher.publish).toHaveBeenCalledWith(
						{
							publishedAt: 1611141535829,
							units: publishUnits,
							hashed: true,
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
								{
									name: "attr1",
									setAt: 1611141535729,
									value: "value1",
								},
							],
						},
						sdk,
						context,
						undefined
					);

					expect(context.pending()).toEqual(0);

					publisher.publish.mockClear();
				})
				.then(() => {
					context.track("goal2", { test: 999 });

					return context.publish();
				})
				.then(() => {
					expect(publisher.publish).toHaveBeenCalledTimes(1);
					expect(publisher.publish).toHaveBeenCalledWith(
						{
							publishedAt: 1611141535829,
							units: publishUnits,
							hashed: true,
							goals: [
								{
									name: "goal2",
									achievedAt: 1611141535829,
									properties: { test: 999 },
								},
							],
							attributes: [
								{
									name: "attr1",
									setAt: 1611141535729,
									value: "value1",
								},
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

					done();
				});
		});

		it("should be called options.publishDelay ms after an exposure being queued", () => {
			jest.useFakeTimers("legacy");
			jest.spyOn(global, "setTimeout");

			const publishDelay = 100;
			const context = new Context(
				sdk,
				Object.assign(contextOptions, { publishDelay }),
				contextParams,
				getContextResponse
			);

			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);
			expect(setTimeout).toHaveBeenCalledTimes(1);
			expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

			context.track("goal1", { amount: 125 });

			expect(context.pending()).toEqual(2);
			expect(setTimeout).toHaveBeenCalledTimes(1); // no new calls
			expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

			jest.advanceTimersByTime(publishDelay - 1);

			expect(publisher.publish).not.toHaveBeenCalled();

			publisher.publish.mockReturnValue(Promise.resolve({}));

			jest.advanceTimersByTime(2);

			expect(publisher.publish).toHaveBeenCalledTimes(1);
		});

		it("should be called options.publishDelay ms after a goal being queued", () => {
			jest.useFakeTimers("legacy");
			jest.spyOn(global, "setTimeout");

			const publishDelay = 100;
			const context = new Context(
				sdk,
				Object.assign(contextOptions, { publishDelay }),
				contextParams,
				getContextResponse
			);

			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			context.track("goal1", { amount: 125 });

			expect(context.pending()).toEqual(1);
			expect(setTimeout).toHaveBeenCalledTimes(1);
			expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(2);
			expect(setTimeout).toHaveBeenCalledTimes(1); // no new calls
			expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

			jest.advanceTimersByTime(publishDelay - 1);

			expect(publisher.publish).not.toHaveBeenCalled();

			publisher.publish.mockReturnValue(Promise.resolve({}));

			jest.advanceTimersByTime(2);

			expect(publisher.publish).toHaveBeenCalledTimes(1);
		});

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
	});

	describe("finalize()", () => {
		it("should not call client publish when queue is empty", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.finalize().then(() => {
				expect(publisher.publish).not.toHaveBeenCalled();
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);
				done();
			});

			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);
		});

		it("should propagate client error message", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			context.treatment("exp_test_ab");

			publisher.publish.mockReturnValue(Promise.reject("test"));

			context.finalize().catch((e) => {
				expect(e).toEqual("test");
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(false);

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);
		});

		it("should call client publish", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context.finalize().then(() => {
				expect(publisher.publish).toHaveBeenCalledTimes(1);
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535829,
						units: publishUnits,
						hashed: true,
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

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);
		});

		it("should pass through request options", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context.finalize({ timeout: 1234 }).then(() => {
				expect(publisher.publish).toHaveBeenCalledTimes(1);
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535829,
						units: publishUnits,
						hashed: true,
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

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);
		});

		it("should call event logger on error", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.treatment("exp_test_ab");

			publisher.publish.mockReturnValue(Promise.reject("test error"));

			SDK.defaultEventLogger.mockClear();
			context.finalize().catch((error) => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "error", error);
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(false);

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);
		});

		it("should call event logger on success", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.treatment("exp_test_ab");

			publisher.publish.mockReturnValue(Promise.resolve());

			SDK.defaultEventLogger.mockClear();
			context.finalize().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(2);
				expect(SDK.defaultEventLogger).toHaveBeenLastCalledWith(context, "finalize", undefined);
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);
		});

		it("should not call client publish when failed", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.reject("bad request error text"));
			context.ready().then(() => {
				context.treatment("exp_test_ab");

				expect(context.pending()).toEqual(1);

				context.finalize().then(() => {
					expect(publisher.publish).not.toHaveBeenCalled();
					expect(context.pending()).toEqual(0);
					expect(context.isFinalizing()).toEqual(false);
					expect(context.isFinalized()).toEqual(true);

					done();
				});

				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);
			});
		});

		it("should return current promise when called twice", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);

			context.treatment("exp_test_ab");

			publisher.publish.mockReturnValue(Promise.resolve());

			const firstPromise = context.finalize();
			const secondPromise = context.finalize();

			expect(secondPromise).toBe(firstPromise);

			secondPromise.then(() => {
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);
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
	});

	describe("override()", () => {
		it("should be callable before ready()", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			context.override("exp_test_ab", 1);
			context.overrides({
				exp_test_ab: 2,
				exp_test_abc: 2,
				not_found: 3,
			});

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(getContextResponse);

				context.treatment("exp_test_ab");
				context.treatment("exp_test_abc");

				publisher.publish.mockReturnValue(Promise.resolve());

				jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

				context.publish().then(() => {
					expect(publisher.publish).toHaveBeenCalledTimes(1);
					expect(publisher.publish).toHaveBeenCalledWith(
						{
							publishedAt: 1611141535829,
							units: publishUnits,
							hashed: true,
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

					done();
				});
			});
		});
	});

	describe("customAssignment()", () => {
		it("should override natural assignment and set custom flag", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			context.customAssignment("exp_test_abc", 11);

			expect(context.pending()).toEqual(0); // should not queue exposures

			context.treatment("exp_test_abc");

			expect(context.pending()).toEqual(1);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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

				done();
			});
		});

		it("should not override full-on or non-eligible assignment", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			expect(context.pending()).toEqual(0);

			context.customAssignment("exp_test_not_eligible", 11);
			context.customAssignment("exp_test_fullon", 11);

			expect(context.pending()).toEqual(0); // should not queue exposures

			context.treatment("exp_test_not_eligible");
			context.treatment("exp_test_fullon");

			expect(context.pending()).toEqual(2);

			publisher.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(publisher.publish).toHaveBeenCalledWith(
					{
						publishedAt: 1611141535729,
						units: publishUnits,
						hashed: true,
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

				done();
			});
		});

		it("should be callable before ready()", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, Promise.resolve(getContextResponse));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			context.customAssignment("exp_test_ab", 1);
			context.customAssignments({
				exp_test_ab: 2,
				exp_test_abc: 2,
				not_found: 3,
			});

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(getContextResponse);

				context.treatment("exp_test_ab");
				context.treatment("exp_test_abc");

				publisher.publish.mockReturnValue(Promise.resolve());

				jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

				context.publish().then(() => {
					expect(publisher.publish).toHaveBeenCalledTimes(1);
					expect(publisher.publish).toHaveBeenCalledWith(
						{
							publishedAt: 1611141535829,
							units: publishUnits,
							hashed: true,
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

					done();
				});
			});
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, contextOptions, contextParams, getContextResponse);
			publisher.publish.mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			context.finalize().then(() => {
				expect(() => context.customAssignment("exp_test_ab", 3)).toThrow(); // finalizing

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.customAssignment("exp_test_ab", 3)).toThrow(); // finalizing
		});
	});
});
