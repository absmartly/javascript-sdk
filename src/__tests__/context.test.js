import { Client } from "@absmartly/javascript-client";
import SDK from "../sdk";
import Context from "../context";

jest.mock("@absmartly/javascript-client");
jest.mock("../sdk");

describe("Context", () => {
	const createContextResponse = {
		guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
		units: [
			{
				type: "session_id",
				uid: "e791e240fcd3df7d238cfc285f475e8152fcc0ec",
			},
		],
		assignments: [
			{
				name: "exp_test_ab",
				unit: "session_id",
				variant: 1,
				eligible: true,
				originalVariant: 1,
				config: '{"a":"1","b.c.a":"2","a.c.b":{"test":5}}',
			},
			{
				name: "exp_test_abc",
				unit: "session_id",
				variant: 2,
				eligible: true,
				originalVariant: 2,
				config: '{"a":"2","b.c.a":"3","a.c.b":{"test":2}}',
			},
			{
				name: "exp_test_not_eligible",
				unit: "user_id",
				variant: 0,
				eligible: false,
				originalVariant: 2,
				config: "{}",
			},
		],
	};

	const refreshContextResponse = Object.assign({}, createContextResponse, {
		assignments: [
			{
				name: "exp_test_refreshed",
				unit: "session_id",
				variant: 2,
				eligible: true,
				originalVariant: 2,
				config: '{"c":"5"}',
			},
		].concat(createContextResponse.assignments),
	});

	const sdk = new SDK();
	const client = new Client();

	const contextOptions = {
		publishDelay: -1,
		refreshPeriod: 0,
		eventLogger: SDK.defaultEventLogger,
	};

	describe("Context", () => {
		it("should be ready with data", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(createContextResponse);
				expect(context.client()).toBe(client);

				done();
			});
		});

		it("should become ready and call handler", (done) => {
			const context = new Context(sdk, client, contextOptions, Promise.resolve(createContextResponse));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(createContextResponse);
				expect(context.client()).toBe(client);

				done();
			});
		});

		it("should become ready and failed, and call handler on failure", (done) => {
			const context = new Context(sdk, client, contextOptions, Promise.reject("bad request error text"));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.isFailed()).toEqual(true);
				expect(context.data()).toStrictEqual({});
				expect(context.client()).toBe(client);

				done();
			});
		});

		it("should call event logger on error", (done) => {
			SDK.defaultEventLogger.mockClear();

			const context = new Context(sdk, client, contextOptions, Promise.reject("bad request error text"));
			context.ready().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "error", "bad request error text");

				done();
			});
		});

		it("should call event logger on success", (done) => {
			SDK.defaultEventLogger.mockClear();

			const context = new Context(sdk, client, contextOptions, Promise.resolve(createContextResponse));
			context.ready().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "ready", createContextResponse);

				done();
			});
		});

		it("should call event logger on pre-fetched experiment data", (done) => {
			SDK.defaultEventLogger.mockClear();

			const context = new Context(sdk, client, contextOptions, createContextResponse);
			context.ready().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "ready", createContextResponse);

				done();
			});
		});

		it("should throw when not ready", (done) => {
			const context = new Context(sdk, client, contextOptions, Promise.resolve(createContextResponse));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			expect(() => context.data()).toThrow();
			expect(() => context.treatment("test")).toThrow();
			expect(() => context.peek("test")).toThrow();
			expect(() => context.experiments()).toThrow();
			expect(() => context.experimentConfig("test")).toThrow();

			done();
		});

		it("should load experiment data", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			expect(context.experiments()).toEqual(createContextResponse.assignments.map((x) => x.name));
			for (const assignment of createContextResponse.assignments) {
				expect(context.treatment(assignment.name)).toEqual(assignment.variant);
				expect(context.peek(assignment.name)).toEqual(assignment.variant);
				expect(context.experimentConfig(assignment.name)).toEqual(
					assignment.config ? JSON.parse(assignment.config) : {}
				);
			}
			expect(context.data()).toEqual(createContextResponse);
			expect(context.experimentConfig("not_found")).toEqual({});

			done();
		});

		it("should start refresh timer after ready", (done) => {
			jest.useFakeTimers();

			const refreshPeriod = 1000;
			const context = new Context(
				sdk,
				client,
				Object.assign(contextOptions, { refreshPeriod }),
				Promise.resolve(createContextResponse)
			);

			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			expect(setInterval).not.toHaveBeenCalled();

			context.ready().then(() => {
				expect(setInterval).toHaveBeenCalledTimes(1);
				expect(setInterval).toHaveBeenCalledWith(expect.anything(), refreshPeriod);
				setInterval.mockClear();

				jest.advanceTimersByTime(refreshPeriod - 1);

				expect(client.refreshContext).not.toHaveBeenCalled();

				const refreshContextPromise = Promise.resolve(refreshContextResponse);
				client.refreshContext.mockReturnValue(refreshContextPromise);

				jest.advanceTimersByTime(refreshPeriod);

				refreshContextPromise.then(() => {
					expect(setInterval).not.toHaveBeenCalled();
					expect(client.refreshContext).toHaveBeenCalledTimes(1);
					expect(client.refreshContext).toHaveBeenCalledWith({
						guid: createContextResponse.guid,
						units: refreshContextResponse.units,
					});
					client.refreshContext.mockClear();

					// test another interval
					const nextRefreshContextPromise = Promise.resolve(refreshContextResponse);
					client.refreshContext.mockReturnValue(nextRefreshContextPromise);

					jest.advanceTimersByTime(refreshPeriod);
					refreshContextPromise.then(() => {
						expect(setInterval).not.toHaveBeenCalled();
						expect(client.refreshContext).toHaveBeenCalledTimes(1);
						expect(client.refreshContext).toHaveBeenCalledWith({
							guid: createContextResponse.guid,
							units: refreshContextResponse.units,
						});

						done();
					});
				});
			});
		});
	});

	describe("attribute()", () => {
		it("should be callable before ready()", (done) => {
			const context = new Context(sdk, client, contextOptions, Promise.resolve(createContextResponse));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			context.attribute("attr1", "value1");
			context.attributes({
				attr2: "value2",
				attr3: 3,
			});

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(createContextResponse);
				expect(context.client()).toBe(client);

				context.treatment("exp_test_ab");

				client.publish.mockReturnValue(Promise.resolve());

				jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

				context.publish().then(() => {
					expect(client.publish).toHaveBeenCalledTimes(1);
					expect(client.publish).toHaveBeenCalledWith({
						guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
						units: createContextResponse.units,
						publishedAt: 1611141535829,
						exposures: [
							{
								name: "exp_test_ab",
								unit: "session_id",
								exposedAt: 1611141535729,
								variant: 1,
								assigned: true,
								eligible: true,
								overridden: false,
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
					});

					done();
				});
			});
		});
	});

	describe("refresh()", () => {
		it("should call client refresh and load new data", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			client.refreshContext.mockReturnValue(Promise.resolve(refreshContextResponse));

			context.refresh().then(() => {
				expect(client.refreshContext).toHaveBeenCalledTimes(1);
				expect(client.refreshContext).toHaveBeenCalledWith({
					guid: createContextResponse.guid,
					units: refreshContextResponse.units,
				});

				expect(context.experiments()).toEqual(refreshContextResponse.assignments.map((x) => x.name));
				for (const assignment of refreshContextResponse.assignments) {
					expect(context.treatment(assignment.name)).toEqual(assignment.variant);
					expect(context.experimentConfig(assignment.name)).toEqual(
						assignment.config ? JSON.parse(assignment.config) : {}
					);
				}
				expect(context.data()).toEqual(refreshContextResponse);
				expect(context.experimentConfig("not_found")).toEqual({});

				done();
			});
		});

		it("should reject promise on error", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			client.refreshContext.mockReturnValueOnce(Promise.reject(new Error("test error")));

			context.refresh().catch((error) => {
				expect(error.message).toEqual("test error");
				done();
			});
		});

		it("should not re-queue exposures after refresh", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			for (const assignment of createContextResponse.assignments) {
				context.treatment(assignment.name);
			}

			expect(context.pending()).toEqual(createContextResponse.assignments.length);

			context.refresh().then(() => {
				expect(context.pending()).toEqual(createContextResponse.assignments.length);

				expect(client.refreshContext).toHaveBeenCalledTimes(1);
				expect(client.refreshContext).toHaveBeenCalledWith({
					guid: createContextResponse.guid,
					units: refreshContextResponse.units,
				});

				for (const assignment of createContextResponse.assignments) {
					context.treatment(assignment.name);
				}

				expect(context.pending()).toEqual(createContextResponse.assignments.length);

				for (const assignment of refreshContextResponse.assignments) {
					context.treatment(assignment.name);
				}

				expect(context.pending()).toEqual(refreshContextResponse.assignments.length);

				done();
			});
		});

		it("should not call client publish when failed", (done) => {
			const context = new Context(sdk, client, contextOptions, Promise.reject("bad request error text"));

			context.ready().then(() => {
				context.refresh().then(() => {
					expect(client.refreshContext).toHaveBeenCalledTimes(0);

					done();
				});
			});
		});

		it("should call event logger when failed", (done) => {
			const context = new Context(sdk, client, contextOptions, Promise.resolve(createContextResponse));
			context.ready().then(() => {
				client.refreshContext.mockReturnValueOnce(Promise.reject(new Error("test error")));

				SDK.defaultEventLogger.mockClear();
				context.refresh().catch((error) => {
					expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
					expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "error", error);

					done();
				});
			});
		});

		it("should call event logger on success", (done) => {
			const context = new Context(sdk, client, contextOptions, Promise.resolve(refreshContextResponse));
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
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			client.publish.mockReturnValue(Promise.resolve());

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
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			client.refreshContext.mockReturnValue(Promise.resolve(refreshContextResponse));

			context.override("not_found", 3);
			expect(context.peek("not_found")).toEqual(3);

			context.refresh().then(() => {
				expect(context.peek("not_found")).toEqual(3);

				done();
			});
		});
	});

	describe("peek()", () => {
		it("should not queue exposures", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			for (const assignment of createContextResponse.assignments) {
				const actual = context.peek(assignment.name);
				expect(actual).toEqual(assignment.variant);
			}

			expect(context.pending()).toEqual(0);

			done();
		});

		it("should return override variant", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			for (const assignment of createContextResponse.assignments) {
				context.override(assignment.name, assignment.variant + 10);
			}
			context.override("not_found", 3);

			for (const assignment of createContextResponse.assignments) {
				expect(context.peek(assignment.name)).toEqual(assignment.variant + 10);
			}

			expect(context.peek("not_found")).toEqual(3);

			expect(context.pending()).toEqual(0);

			done();
		});
	});

	describe("treatment()", () => {
		it("should queue exposures", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			for (const assignment of createContextResponse.assignments) {
				context.treatment(assignment.name);
			}

			expect(context.pending()).toEqual(createContextResponse.assignments.length);

			for (const assignment of createContextResponse.assignments) {
				context.treatment(assignment.name);
			}

			expect(context.pending()).toEqual(createContextResponse.assignments.length);

			client.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(client.publish).toHaveBeenCalledWith({
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					publishedAt: 1611141535729,
					units: createContextResponse.units,
					exposures: [
						{
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_ab",
							overridden: false,
							unit: "session_id",
							variant: 1,
						},
						{
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_abc",
							overridden: false,
							unit: "session_id",
							variant: 2,
						},
						{
							assigned: true,
							eligible: false,
							exposedAt: 1611141535729,
							name: "exp_test_not_eligible",
							overridden: false,
							unit: "user_id",
							variant: 0,
						},
					],
				});

				done();
			});
		});

		it("should queue exposures only once", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			for (const assignment of createContextResponse.assignments) {
				context.treatment(assignment.name);
			}

			expect(context.pending()).toEqual(createContextResponse.assignments.length);

			for (const assignment of createContextResponse.assignments) {
				context.treatment(assignment.name);
			}

			expect(context.pending()).toEqual(createContextResponse.assignments.length);

			done();
		});

		it("should call event logger", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);
			for (const assignment of createContextResponse.assignments) {
				SDK.defaultEventLogger.mockClear();
				context.treatment(assignment.name);
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "exposure", {
					exposedAt: timeOrigin,
					eligible: assignment.eligible,
					assigned: true,
					overridden: false,
					name: assignment.name,
					unit: assignment.unit,
					variant: assignment.variant,
				});
			}

			// check it calls logger only once
			for (const assignment of createContextResponse.assignments) {
				SDK.defaultEventLogger.mockClear();
				context.treatment(assignment.name);
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(0);
			}

			done();
		});

		it("should queue exposure with base variant on unknown experiment", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			expect(context.treatment("not_found")).toEqual(0);

			expect(context.pending()).toEqual(1);

			client.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(client.publish).toHaveBeenCalledWith({
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					publishedAt: 1611141535729,
					units: createContextResponse.units,
					exposures: [
						{
							assigned: false,
							eligible: true,
							exposedAt: 1611141535729,
							name: "not_found",
							overridden: false,
							unit: null,
							variant: 0,
						},
					],
				});

				done();
			});
		});

		it("should queue exposure with override variant", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			context.override("exp_test_ab", 5);
			context.override("not_found", 3);

			expect(context.treatment("exp_test_ab")).toEqual(5);
			expect(context.treatment("not_found")).toEqual(3);

			expect(context.pending()).toEqual(2);

			client.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(client.publish).toHaveBeenCalledWith({
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					publishedAt: 1611141535729,
					units: createContextResponse.units,
					exposures: [
						{
							assigned: true,
							eligible: true,
							exposedAt: 1611141535729,
							name: "exp_test_ab",
							overridden: true,
							unit: "session_id",
							variant: 5,
						},
						{
							assigned: false,
							eligible: true,
							exposedAt: 1611141535729,
							name: "not_found",
							overridden: true,
							unit: null,
							variant: 3,
						},
					],
				});

				done();
			});
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			client.publish.mockReturnValue(Promise.resolve());

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

	describe("track()", () => {
		it("should queue goals", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			context.track("goal1", [125, 245]);
			context.track("goal2", [256]);

			expect(context.pending()).toEqual(2);

			context.track("goal2", 12);

			expect(context.pending()).toEqual(3);

			client.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(client.publish).toHaveBeenCalledWith({
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					publishedAt: 1611141535729,
					units: createContextResponse.units,
					goals: [
						{
							achievedAt: 1611141535729,
							name: "goal1",
							values: [125, 245],
						},
						{
							achievedAt: 1611141535729,
							name: "goal2",
							values: [256],
						},
						{
							achievedAt: 1611141535729,
							name: "goal2",
							values: [12],
						},
					],
				});

				done();
			});
		});

		it("should call event logger", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);

			SDK.defaultEventLogger.mockClear();
			context.track("goal1", [125, 245]);
			expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
			expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "goal", {
				achievedAt: timeOrigin,
				name: "goal1",
				values: [125, 245],
			});

			done();
		});

		it("should throw when too many goal values", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			expect(() => context.track("goal1", [125, 245, 999])).toThrow();
			expect(context.pending()).toEqual(0);

			done();
		});

		it("should throw when goal values not integers", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			expect(() => context.track("goal1", 125.125)).toThrowError();
			expect(() => context.track("goal1", [125.125, 245])).toThrowError();
			expect(() => context.track("goal1", 125.125)).toThrowError();
			expect(() => context.track("goal1", "abs")).toThrowError();
			expect(context.pending()).toEqual(0);

			done();
		});

		it("should convert single goal value to array", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			context.track("goal1", 125.0);

			expect(context.pending()).toEqual(1);

			client.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context.publish().then(() => {
				expect(client.publish).toHaveBeenCalledTimes(1);
				expect(client.publish).toHaveBeenCalledWith({
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					publishedAt: 1611141535829,
					units: createContextResponse.units,
					goals: [
						{
							name: "goal1",
							achievedAt: 1611141535729,
							values: [125.0],
						},
					],
				});

				expect(context.pending()).toEqual(0);

				done();
			});
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			client.publish.mockReturnValue(Promise.resolve());

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			context.finalize().then(() => {
				expect(() => context.track("payment", 125.0)).toThrow();

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(() => context.track("payment", 125.0)).toThrow();
		});

		it("should queue when not ready", (done) => {
			const context = new Context(sdk, client, contextOptions, Promise.resolve(createContextResponse));
			expect(context.pending()).toEqual(0);
			expect(context.isReady()).toEqual(false);

			context.track("goal1", 125.0);

			expect(context.pending()).toEqual(1);
			expect(context.isReady()).toEqual(false);

			context.ready().then(() => {
				expect(context.pending()).toEqual(1);

				done();
			});
		});

		it("should start timeout after ready if queue is not empty", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			jest.useFakeTimers();

			const publishDelay = 100;
			const context = new Context(
				sdk,
				client,
				Object.assign(contextOptions, { publishDelay }),
				Promise.resolve(createContextResponse)
			);

			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);

			context.track("goal1", 125);

			expect(context.pending()).toEqual(1);

			context.ready().then(() => {
				expect(setTimeout).toHaveBeenCalledTimes(1);
				expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

				jest.advanceTimersByTime(publishDelay - 1);

				expect(client.publish).not.toHaveBeenCalled();

				client.publish.mockReturnValue(Promise.resolve({}));

				jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

				jest.advanceTimersByTime(2);

				expect(client.publish).toHaveBeenCalledTimes(1);
				expect(client.publish).toHaveBeenCalledWith({
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					units: createContextResponse.units,
					publishedAt: 1611141535829,
					goals: [
						{
							name: "goal1",
							achievedAt: 1611141535729,
							values: [125.0],
						},
					],
				});

				done();
			});
		});
	});

	describe("publish()", () => {
		it("should not call client publish when queue is empty", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			client.publish.mockReturnValue(Promise.resolve());

			context.publish().then(() => {
				expect(client.publish).not.toHaveBeenCalled();
				done();
			});
		});

		it("should propagate client error message", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			context.track("goal1", [125.0, 245]);

			client.publish.mockReturnValue(Promise.reject("test"));

			context.publish().catch((e) => {
				expect(e).toEqual("test");

				done();
			});
		});

		it("should call client publish", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.treatment("exp_test_ab");
			context.treatment("exp_test_not_eligible");

			Date.now.mockImplementation(() => timeOrigin + 1); // ensure that time is kept separately per event
			context.track("goal1", [125.0, 245]);

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

			client.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context.publish().then(() => {
				expect(client.publish).toHaveBeenCalledTimes(1);
				expect(client.publish).toHaveBeenCalledWith({
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					units: createContextResponse.units,
					publishedAt: 1611141535829,
					exposures: [
						{
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
						},
						{
							name: "exp_test_not_eligible",
							unit: "user_id",
							exposedAt: 1611141535729,
							variant: 0,
							assigned: true,
							eligible: false,
							overridden: false,
						},
					],
					goals: [
						{
							name: "goal1",
							achievedAt: 1611141535730,
							values: [125, 245],
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
				});

				expect(context.pending()).toEqual(0);

				done();
			});
		});

		it("should call event logger on error", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.track("goal1", [125.0, 245]);

			client.publish.mockReturnValue(Promise.reject("test error"));

			SDK.defaultEventLogger.mockClear();
			context.publish().catch((error) => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "error", error);

				done();
			});
		});

		it("should call event logger on success", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.track("goal1", [125.0, 245]);

			client.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			SDK.defaultEventLogger.mockClear();
			context.publish().then(() => {
				expect(SDK.defaultEventLogger).toHaveBeenCalledTimes(1);
				expect(SDK.defaultEventLogger).toHaveBeenCalledWith(context, "publish", {
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					publishedAt: 1611141535829,
					units: [
						{
							type: "session_id",
							uid: "e791e240fcd3df7d238cfc285f475e8152fcc0ec",
						},
					],
					goals: [
						{
							achievedAt: 1611141535729,
							name: "goal1",
							values: [125, 245],
						},
					],
				});

				done();
			});
		});

		it("should throw on unsupported attribute type", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			expect(() => context.attribute("attr1", {})).toThrow(
				new Error("Attribute 'attr1' is of unsupported type 'object'")
			);
			expect(() => context.attribute("attr1", [1, {}])).toThrow(
				new Error("Attribute 'attr1' element at index 1 is of unsupported type 'object'")
			);
			expect(() => context.attribute("attr1", [1, "two"])).toThrow(
				new Error("Attribute 'attr1' has elements of different types")
			);

			done();
		});

		it("should not call client publish when failed", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, Promise.reject("bad request error text"));
			context.ready().then(() => {
				context.treatment("exp_test_ab");

				Date.now.mockImplementation(() => timeOrigin + 1); // ensure that time is kept separately per event
				context.track("goal1", [125.0, 245]);

				expect(context.pending()).toEqual(2);

				context.publish().then(() => {
					expect(client.publish).toHaveBeenCalledTimes(0);
					expect(context.pending()).toEqual(0);

					done();
				});
			});
		});

		it("should reset internal queues and keep attributes and overrides", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.treatment("exp_test_ab");
			context.treatment("not_found");
			context.track("goal1", [125.0, 245]);
			context.attribute("attr1", "value1");

			context.override("not_found", 3);
			expect(context.peek("not_found")).toEqual(3);

			expect(context.pending()).toEqual(3);

			client.publish.mockReturnValue(Promise.resolve({}));

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context
				.publish()
				.then(() => {
					expect(client.publish).toHaveBeenCalledTimes(1);
					expect(client.publish).toHaveBeenCalledWith({
						guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
						units: createContextResponse.units,
						publishedAt: 1611141535829,
						exposures: [
							{
								name: "exp_test_ab",
								unit: "session_id",
								exposedAt: 1611141535729,
								variant: 1,
								assigned: true,
								eligible: true,
								overridden: false,
							},
							{
								name: "not_found",
								unit: null,
								exposedAt: 1611141535729,
								variant: 0,
								assigned: false,
								eligible: true,
								overridden: false,
							},
						],
						goals: [
							{
								name: "goal1",
								achievedAt: 1611141535729,
								values: [125, 245],
							},
						],
						attributes: [
							{
								name: "attr1",
								setAt: 1611141535729,
								value: "value1",
							},
						],
					});

					expect(context.pending()).toEqual(0);

					client.publish.mockClear();
				})
				.then(() => {
					context.track("goal2", [999]);

					return context.publish();
				})
				.then(() => {
					expect(client.publish).toHaveBeenCalledTimes(1);
					expect(client.publish).toHaveBeenCalledWith({
						guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
						units: createContextResponse.units,
						publishedAt: 1611141535829,
						goals: [
							{
								name: "goal2",
								achievedAt: 1611141535829,
								values: [999],
							},
						],
						attributes: [
							{
								name: "attr1",
								setAt: 1611141535729,
								value: "value1",
							},
						],
					});

					expect(context.pending()).toEqual(0);

					expect(context.peek("not_found")).toEqual(3);

					done();
				});
		});

		it("should be called options.publishDelay ms after an exposure being queued", () => {
			jest.useFakeTimers();

			const publishDelay = 100;
			const context = new Context(
				sdk,
				client,
				Object.assign(contextOptions, { publishDelay }),
				createContextResponse
			);

			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);
			expect(setTimeout).toHaveBeenCalledTimes(1);
			expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

			context.track("goal1", 125);

			expect(context.pending()).toEqual(2);
			expect(setTimeout).toHaveBeenCalledTimes(1); // no new calls
			expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

			jest.advanceTimersByTime(publishDelay - 1);

			expect(client.publish).not.toHaveBeenCalled();

			client.publish.mockReturnValue(Promise.resolve({}));

			jest.advanceTimersByTime(2);

			expect(client.publish).toHaveBeenCalledTimes(1);
		});

		it("should be called options.publishDelay ms after a goal being queued", () => {
			jest.useFakeTimers();

			const publishDelay = 100;
			const context = new Context(
				sdk,
				client,
				Object.assign(contextOptions, { publishDelay }),
				createContextResponse
			);

			expect(context.isReady()).toEqual(true);
			expect(context.isFailed()).toEqual(false);

			context.track("goal1", 125);

			expect(context.pending()).toEqual(1);
			expect(setTimeout).toHaveBeenCalledTimes(1);
			expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(2);
			expect(setTimeout).toHaveBeenCalledTimes(1); // no new calls
			expect(setTimeout).toHaveBeenLastCalledWith(expect.anything(), publishDelay);

			jest.advanceTimersByTime(publishDelay - 1);

			expect(client.publish).not.toHaveBeenCalled();

			client.publish.mockReturnValue(Promise.resolve({}));

			jest.advanceTimersByTime(2);

			expect(client.publish).toHaveBeenCalledTimes(1);
		});

		it("should throw after finalized() call", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			client.publish.mockReturnValue(Promise.resolve());

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
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			client.publish.mockReturnValue(Promise.resolve());

			context.finalize().then(() => {
				expect(client.publish).not.toHaveBeenCalled();
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);
				done();
			});

			expect(context.isFinalizing()).toEqual(false);
			expect(context.isFinalized()).toEqual(true);
		});

		it("should propagate client error message", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);
			expect(context.pending()).toEqual(0);

			context.treatment("exp_test_ab");

			client.publish.mockReturnValue(Promise.reject("test"));

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
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.treatment("exp_test_ab");

			expect(context.pending()).toEqual(1);

			client.publish.mockReturnValue(Promise.resolve());

			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

			context.finalize().then(() => {
				expect(client.publish).toHaveBeenCalledTimes(1);
				expect(client.publish).toHaveBeenCalledWith({
					guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
					units: createContextResponse.units,
					publishedAt: 1611141535829,
					exposures: [
						{
							name: "exp_test_ab",
							unit: "session_id",
							exposedAt: 1611141535729,
							variant: 1,
							assigned: true,
							eligible: true,
							overridden: false,
						},
					],
				});

				expect(context.pending()).toEqual(0);
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);

				done();
			});

			expect(context.isFinalizing()).toEqual(true);
			expect(context.isFinalized()).toEqual(false);
		});

		it("should call event logger on error", (done) => {
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.treatment("exp_test_ab");

			client.publish.mockReturnValue(Promise.reject("test error"));

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
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.treatment("exp_test_ab");

			client.publish.mockReturnValue(Promise.resolve());

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
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			const context = new Context(sdk, client, contextOptions, Promise.reject("bad request error text"));
			context.ready().then(() => {
				context.treatment("exp_test_ab");

				expect(context.pending()).toEqual(1);

				context.finalize().then(() => {
					expect(client.publish).toHaveBeenCalledTimes(0);
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
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.treatment("exp_test_ab");

			client.publish.mockReturnValue(Promise.resolve());

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
			const context = new Context(sdk, client, contextOptions, createContextResponse);

			context.treatment("exp_test_ab");

			client.publish.mockReturnValue(Promise.resolve());

			context.finalize().then(() => {
				expect(context.isFinalizing()).toEqual(false);
				expect(context.isFinalized()).toEqual(true);

				context.finalize().then(() => {
					done();
				});
			});
		});

		it("should cancel refresh timer", (done) => {
			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			jest.useFakeTimers();

			const refreshPeriod = 1000;
			const context = new Context(
				sdk,
				client,
				Object.assign(contextOptions, { refreshPeriod }),
				createContextResponse
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
			const context = new Context(sdk, client, contextOptions, Promise.resolve(createContextResponse));
			expect(context.isReady()).toEqual(false);
			expect(context.isFailed()).toEqual(false);
			expect(context.isFinalized()).toEqual(false);

			const timeOrigin = 1611141535729;
			jest.spyOn(Date, "now").mockImplementation(() => timeOrigin);

			context.override("exp_test_ab", 1);
			context.overrides({
				exp_test_ab: 2,
				exp_test_abc: 2,
				not_found: 3,
			});

			context.ready().then(() => {
				expect(context.isReady()).toEqual(true);
				expect(context.data()).toStrictEqual(createContextResponse);
				expect(context.client()).toBe(client);

				context.treatment("exp_test_ab");
				context.treatment("exp_test_abc");

				client.publish.mockReturnValue(Promise.resolve());

				jest.spyOn(Date, "now").mockImplementation(() => timeOrigin + 100);

				context.publish().then(() => {
					expect(client.publish).toHaveBeenCalledTimes(1);
					expect(client.publish).toHaveBeenCalledWith({
						guid: "8cbcf4da566d8689dd48c13e1ac11d7113d074ec",
						units: createContextResponse.units,
						publishedAt: 1611141535829,
						exposures: [
							{
								name: "exp_test_ab",
								unit: "session_id",
								exposedAt: 1611141535729,
								variant: 2,
								assigned: true,
								eligible: true,
								overridden: true,
							},
							{
								name: "exp_test_abc",
								unit: "session_id",
								exposedAt: 1611141535729,
								variant: 2,
								assigned: true,
								eligible: true,
								overridden: true,
							},
						],
					});

					done();
				});
			});
		});
	});
});
