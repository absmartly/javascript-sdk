import { JsonExpr } from "../jsonexpr/jsonexpr";
import SDK from "../sdk";
import { SDK_VERSION } from "../version";
import pkg from "../../package.json";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import Client from "../client";
import sdkFetch from "../fetch";
import { AudienceMatcher } from "../matcher";

jest.mock("../fetch");

const options = { endpoint: "https://collector/v1", apiKey: "k", application: "web", environment: "prod" };

describe("1.13.4 source and behaviour compatibility", () => {
	it("preserves replacement and subclass boolean-expression hooks", () => {
		const matcher = new AudienceMatcher();
		const replacement = { evaluateBooleanExpr: jest.fn(() => true), evaluateExpr: () => true };
		matcher._jsonExpr = replacement;
		expect(matcher.evaluate('{"filter":{"value":true}}', {})).toBe(true);
		expect(replacement.evaluateBooleanExpr).toHaveBeenCalledTimes(1);
		class CustomExpr extends JsonExpr {
			evaluateBooleanExpr() {
				return false;
			}
		}
		matcher._jsonExpr = new CustomExpr();
		expect(matcher.evaluate('{"filter":{"value":true}}', {})).toBe(false);
	});

	const cacheProbeExperiment = (extra = {}) => ({
		id: 40,
		name: "cacheProbe",
		iteration: 1,
		unitType: "session_id",
		seedHi: 1,
		seedLo: 2,
		split: [0.5, 0.5],
		trafficSeedHi: 3,
		trafficSeedLo: 4,
		trafficSplit: [0, 1],
		fullOnVariant: 0,
		applications: [{ name: "web" }],
		variants: [
			{ name: "A", config: null },
			{ name: "B", config: null },
		],
		audience: null,
		audienceStrict: false,
		customFieldValues: null,
		...extra,
	});

	it("caches the rule identity on the initial assignment", () => {
		const experiment = cacheProbeExperiment({
			assignmentRules: JSON.stringify({
				rules: [{ type: "assign", variant: 1, conditions: { value: true } }],
			}),
		});
		const context = new SDK(options).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [experiment] }
		);
		const spy = jest.spyOn(AudienceMatcher.prototype, "evaluateParsedRules");
		try {
			for (let i = 0; i < 100; i++) expect(context.treatment("cacheProbe")).toBe(1);
			expect(spy).toHaveBeenCalledTimes(1);
			expect(context.pending()).toBe(1);
		} finally {
			spy.mockRestore();
		}
	});

	it("refreshes rule identity when a custom client's configured environment changes", async () => {
		let environment = "prod";
		const client = new Client(options);
		client.getEnvironment = () => environment;
		const experiment = cacheProbeExperiment({
			assignmentRules: JSON.stringify({
				rules: [
					{ type: "assign", variant: 0, environments: ["prod"], conditions: null },
					{ type: "assign", variant: 1, environments: ["staging"], conditions: null },
				],
			}),
		});
		const data = { experiments: [experiment] };
		const provider = { getContextData: () => Promise.resolve(data) };
		const context = new SDK({ ...options, client, provider }).createContextWith(
			{ units: { session_id: "u1" } },
			data
		);
		expect(context.peek("cacheProbe")).toBe(0);
		environment = "staging";
		await context.refresh();
		expect(context.peek("cacheProbe")).toBe(1);
	});

	it.each(["fetch", "with-data", "refresh"])("ignores future assignment-rule fields via %s", async (creation) => {
		const ruled = cacheProbeExperiment({
			assignmentRules: JSON.stringify({
				rules: [
					{
						type: "assign",
						variant: 1,
						conditions: null,
						futureScalar: "x",
						futureObject: { x: [1] },
						futureArray: [{ y: true }],
					},
				],
			}),
			trafficSplit: [1, 0],
		});
		const ordinary = { ...cacheProbeExperiment(), id: 41, name: "ordinary", split: [0, 1] };
		const data = { experiments: [ruled, ordinary] };
		const provider = { getContextData: () => Promise.resolve(data) };
		const sdk = new SDK({ ...options, provider });
		const params = { units: { session_id: "u1" } };
		const context = creation === "fetch" ? sdk.createContext(params) : sdk.createContextWith(params, data);
		await context.ready();
		if (creation === "refresh") await context.refresh();
		expect(context.treatment("cacheProbe")).toBe(1);
		expect(context.treatment("ordinary")).toBe(1);
	});

	it.each(["fetch", "with-data", "refresh"])(
		"treats non-string assignment rules as no rules via %s",
		async (creation) => {
			const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
			try {
				const malformed = ["", { toString: null }, ["x"], 1, true, { rules: [] }];
				const experiments = malformed.map((assignmentRules, i) => ({
					...cacheProbeExperiment({ assignmentRules }),
					id: 50 + i,
					name: `malformed${i}`,
					split: [0, 1],
				}));
				const ordinary = { ...cacheProbeExperiment(), id: 41, name: "ordinary", split: [0, 1] };
				const data = { experiments: [...experiments, ordinary] };
				const provider = { getContextData: () => Promise.resolve(data) };
				const sdk = new SDK({ ...options, provider });
				const params = { units: { session_id: "u1" } };
				const context = creation === "fetch" ? sdk.createContext(params) : sdk.createContextWith(params, data);
				await context.ready();
				if (creation === "refresh") await context.refresh();
				expect(context.isFailed()).toBe(false);
				experiments.forEach((experiment) => expect(context.treatment(experiment.name)).toBe(1));
				context.attribute("age", 1);
				experiments.forEach((experiment) => expect(context.treatment(experiment.name)).toBe(1));
				expect(context.treatment("ordinary")).toBe(1);
				expect(errorSpy).not.toHaveBeenCalled();
			} finally {
				errorSpy.mockRestore();
			}
		}
	);

	it("ignores unknown context-data fields at every payload level, including after refresh", async () => {
		const eventLogger = jest.fn();
		const experiment = (id, experimentName) => ({
			id,
			name: experimentName,
			iteration: 1,
			unitType: "session_id",
			seedHi: 3603515 + id,
			seedLo: 233373850 + id,
			split: [0.5, 0.5],
			trafficSeedHi: 449867249,
			trafficSeedLo: 455443629,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web", futureApplication: [1] }],
			audience: null,
			audienceStrict: false,
			variants: [
				{ name: "A", config: null, futureVariant: { nested: true } },
				{ name: "B", config: null, futureVariant: 2 },
			],
			customFieldValues: [{ name: "f", type: "string", value: "x", futureField: [1, { y: 2 }] }],
			futureExperiment: "scalar",
			futureObject: { a: [1] },
			futureArray: [{ b: 2 }],
		});
		const data = {
			experiments: [experiment(21, "unknownA"), experiment(22, "unknownB")],
			futureRoot: { nested: [1] },
			futureList: [1, "x"],
		};
		const provider = { getContextData: () => Promise.resolve(data) };
		const uids = ["u1", "u2", "u3", "u4"];
		const assigned = () =>
			uids.map((uid) => {
				const context = new SDK({ ...options, provider, eventLogger }).createContextWith(
					{ units: { session_id: uid } },
					data
				);
				return [context.treatment("unknownA"), context.treatment("unknownB")];
			});
		const before = assigned();
		const context = new SDK({ ...options, provider, eventLogger }).createContextWith(
			{ units: { session_id: "u1" } },
			data
		);
		await context.refresh();
		expect(assigned()).toEqual(before);
		expect([context.treatment("unknownA"), context.treatment("unknownB")]).toEqual(before[0]);
		expect(eventLogger.mock.calls.filter(([, eventName]) => eventName === "error")).toHaveLength(0);
	});

	it("preserves the runtime's native null-indexing error text and shape", () => {
		let native;
		try {
			const nullValue = null;
			nullValue["plan"];
		} catch (error) {
			native = error;
		}
		let actual;
		try {
			new JsonExpr().evaluateExpr({ var: "user/plan" }, { user: null });
		} catch (error) {
			actual = error;
		}
		expect(actual).toBeInstanceOf(TypeError);
		expect(actual.message).toBe(native.message);
		expect(Object.keys(actual)).toEqual(Object.keys(native));
	});

	it("uses the client retry budget for request timeout zero", async () => {
		sdkFetch.mockRejectedValue(new Error("connection refused"));
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const client = new Client({ ...options, timeout: 3000, retries: 1 });
			const error = await client.request({ path: "/context", method: "GET", timeout: 0 }).catch((e) => e);
			expect(sdkFetch).toHaveBeenCalledTimes(2);
			expect(error.name).toBe("RetryError");
		} finally {
			warn.mockRestore();
		}
	});

	beforeEach(() => {
		sdkFetch.mockReset();
	});

	it("returns a copy from getUnits() and brands error strings ABsmartly", async () => {
		const sdk = new SDK(options);
		const context = sdk.createContextWith({ units: { user: "one" } }, { experiments: [] });
		const units = context.getUnits();
		units.session = "two";
		expect(context.getUnit("session")).toBeUndefined();
		expect(context.getUnits()).not.toBe(units);
		expect(context.getUnits()).toEqual({ user: "one" });
		await context.finalize();
		expect(() => context.treatment("e")).toThrow("ABsmartly Context is finalized.");
	});

	it("requires a custom client to provide getApplication(), getEnvironment() and getAgent()", () => {
		const client = { getContext: () => Promise.resolve({ experiments: [] }), publish: () => Promise.resolve() };
		const sdk = new SDK({ ...options, client });
		expect(() => sdk.createContextWith({ units: { user: "one" } }, { experiments: [] })).toThrow(TypeError);
	});

	it.each([null, "", 1004, " 1004 ", "3.2.1", -1, "١٠٠٤", "1234567890123456789"])(
		"normalizes collector application-version headers on GET and PUT: %p",
		async (version) => {
			sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
			const sdk = new SDK({ ...options, application: { name: "web", version } });
			await sdk.getClient().getContext();
			await sdk.getClient().publish({ units: [], hashed: true, publishedAt: 1 });
			const expected = version === 1004 ? 1004 : version === " 1004 " ? "1004" : 0;
			for (const [, request] of sdkFetch.mock.calls) {
				expect(request.headers["X-Application-Version"]).toBe(expected);
				expect(request.headers["X-Agent"]).toBe(`absmartly-javascript-sdk/${SDK_VERSION}`);
			}
			expect(sdk.getClient().getApplication().version).toBe(version);
		}
	);

	it.each([
		["omitted", undefined],
		["false", false],
	])("does not warn about the deprecated auth option when it is %s", async (_label, auth) => {
		sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		await new Client(options).request({ path: "/x", method: "GET", auth });
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	// With no deadline the first retry waits the full 50 ms backoff; a deadline clamp would cut it to
	// `timeout - waited` (0 ms), so the retry would fire at once.
	it("keeps the full retry backoff when timeout is 0", async () => {
		jest.useFakeTimers();
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const random = jest.spyOn(Math, "random").mockReturnValue(0);
		try {
			sdkFetch
				.mockRejectedValueOnce(new Error("connection refused"))
				.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
			const result = new Client({ ...options, timeout: 0, retries: 2 }).request({ path: "/x", method: "GET" });
			for (let i = 0; i < 5; i++) await Promise.resolve();
			expect(sdkFetch).toHaveBeenCalledTimes(1);
			jest.advanceTimersByTime(49);
			for (let i = 0; i < 5; i++) await Promise.resolve();
			expect(sdkFetch).toHaveBeenCalledTimes(1);
			jest.advanceTimersByTime(1);
			await expect(result).resolves.toEqual({});
			expect(sdkFetch).toHaveBeenCalledTimes(2);
		} finally {
			random.mockRestore();
			warn.mockRestore();
			jest.useRealTimers();
		}
	});

	it("reports a custom client without getApplication() when an audience is evaluated", () => {
		const eventLogger = jest.fn();
		const client = {
			getContext: () => Promise.resolve({ experiments: [] }),
			publish: () => Promise.resolve(),
			getEnvironment: () => "prod",
			getAgent: () => "agent",
		};
		const context = new SDK({ ...options, client, eventLogger }).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [cacheProbeExperiment({ audience: '{"filter":[{"value":true}]}' })] }
		);
		context.treatment("cacheProbe");
		const errors = eventLogger.mock.calls.filter(([, eventName]) => eventName === "error").map(([, , e]) => e);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toBeInstanceOf(TypeError);
	});

	it("rejects publish() with includeSystemAttributes for a custom client without getAgent()", async () => {
		const client = {
			getContext: () => Promise.resolve({ experiments: [] }),
			publish: () => Promise.resolve(),
			getApplication: () => ({ name: "web", version: 0 }),
			getEnvironment: () => "prod",
		};
		const context = new SDK({ ...options, client }).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [] },
			{ publishDelay: -1, includeSystemAttributes: true }
		);
		context.track("g");
		await expect(Promise.resolve().then(() => context.publish())).rejects.toThrow(TypeError);
	});

	it("uses the configured application, environment and agent getters of a custom client", async () => {
		const publish = jest.fn(() => Promise.resolve());
		const client = {
			getContext: () => Promise.resolve({ experiments: [] }),
			publish,
			getApplication: () => ({ name: "custom-app", version: 0 }),
			getEnvironment: () => "custom-env",
			getAgent: () => "custom-agent/1",
		};
		const sdk = new SDK({ ...options, client });
		const context = sdk.createContextWith(
			{ units: { session_id: "u1" } },
			{
				experiments: [
					{
						...cacheProbeExperiment(),
						name: "systemNames",
						audienceStrict: true,
						audience: JSON.stringify({
							filter: [
								{
									and: [
										{ eq: [{ var: "application" }, { value: "custom-app" }] },
										{ eq: [{ var: "environment" }, { value: "custom-env" }] },
									],
								},
							],
						}),
						trafficSplit: [0, 1],
						fullOnVariant: 1,
					},
				],
			},
			{ publishDelay: -1, includeSystemAttributes: true }
		);
		expect(context.treatment("systemNames")).toBe(1);
		await context.publish();
		const attributes = publish.mock.calls[0][0].attributes;
		expect(attributes.find((a) => a.name === "sdk_name").value).toBe("custom-agent/1");
	});

	it("reports the counts of the exposures and goals a failed context discards", async () => {
		const eventLogger = jest.fn();
		const provider = { getContextData: () => Promise.reject(new Error("load failed")) };
		const context = new SDK({ ...options, provider, eventLogger }).createContext({ units: { session_id: "u1" } });
		await context.ready();
		context.treatment("a");
		context.track("g1");
		context.track("g2");
		await context.publish();
		const messages = eventLogger.mock.calls
			.filter(([, eventName]) => eventName === "error")
			.map(([, , error]) => error.message);
		expect(messages).toContain("Discarding 1 exposures and 2 goals because context failed to initialize");
	});

	it("warns about auth: true once per request, not once per retry, on every request", async () => {
		sdkFetch
			.mockRejectedValueOnce(new Error("connection refused"))
			.mockRejectedValueOnce(new Error("connection refused"))
			.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const deprecation = () => warn.mock.calls.filter(([message]) => /deprecated/.test(String(message))).length;
		try {
			const client = new Client({ ...options, retries: 3 });
			await client.request({ path: "/x", method: "GET", auth: true });
			expect(sdkFetch).toHaveBeenCalledTimes(3);
			expect(deprecation()).toBe(1);
			await client.request({ path: "/x", method: "GET", auth: true });
			expect(deprecation()).toBe(2);
		} finally {
			warn.mockRestore();
		}
	});

	it("passes a null client option through to the Client, unlike an undefined one", () => {
		expect(() => new SDK({ ...options, agent: null })).toThrow();
		expect(new SDK({ ...options, agent: undefined }).getClient().getAgent()).toBe(
			`absmartly-javascript-sdk/${SDK_VERSION}`
		);
	});

	it("treats a negative timeout like 0: retries without a deadline", async () => {
		sdkFetch.mockRejectedValue(new Error("connection refused"));
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const client = new Client({ ...options, timeout: 3000, retries: 3 });
			const error = await client.request({ path: "/x", method: "GET", timeout: -1 }).catch((e) => e);
			expect(error.name).toBe("RetryError");
			expect(sdkFetch).toHaveBeenCalledTimes(4);
		} finally {
			warn.mockRestore();
		}
	});

	it("reports a discarded goal-only queue of a failed context", async () => {
		const eventLogger = jest.fn();
		const provider = { getContextData: () => Promise.reject(new Error("load failed")) };
		const context = new SDK({ ...options, provider, eventLogger }).createContext({ units: { session_id: "u1" } });
		await context.ready();
		context.track("g1");
		await context.publish();
		const messages = eventLogger.mock.calls
			.filter(([, eventName]) => eventName === "error")
			.map(([, , error]) => error.message);
		expect(messages).toContain("Discarding 0 exposures and 1 goals because context failed to initialize");
	});

	it("rejects ready() of a fetched context whose custom client lacks getEnvironment()", async () => {
		const client = { getContext: () => Promise.resolve({ experiments: [] }), publish: () => Promise.resolve() };
		const context = new SDK({ ...options, client }).createContext({ units: { session_id: "u1" } });
		await expect(context.ready()).rejects.toThrow(TypeError);
	});

	it("parses a mismatching strict audience once per evaluation", () => {
		const audience = '{"filter":[{"value":false}]}';
		const parse = jest.spyOn(JSON, "parse");
		try {
			const context = new SDK(options).createContextWith(
				{ units: { session_id: "u1" } },
				{ experiments: [cacheProbeExperiment({ audience, audienceStrict: true })] }
			);
			parse.mockClear();
			expect(context.peek("cacheProbe")).toBe(0);
			expect(parse.mock.calls.filter(([text]) => text === audience)).toHaveLength(1);
		} finally {
			parse.mockRestore();
		}
	});

	it("throws a TypeError reading a rule experiment through a custom client without getApplication()", () => {
		const client = {
			getContext: () => Promise.resolve({ experiments: [] }),
			publish: () => Promise.resolve(),
			getEnvironment: () => "prod",
			getAgent: () => "agent",
		};
		const experiment = cacheProbeExperiment({
			assignmentRules: JSON.stringify({ rules: [{ type: "assign", variant: 1, conditions: { value: true } }] }),
		});
		const context = new SDK({ ...options, client, eventLogger() {} }).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [experiment] }
		);
		expect(() => context.peek("cacheProbe")).toThrow(TypeError);
	});

	it("parses a valid audience once per evaluation", () => {
		const parse = jest.spyOn(JSON, "parse");
		try {
			const context = new SDK(options).createContextWith(
				{ units: { session_id: "u1" } },
				{ experiments: [cacheProbeExperiment({ audience: '{"filter":[{"value":true}]}' })] }
			);
			parse.mockClear();
			context.peek("cacheProbe");
			expect(parse.mock.calls.filter(([text]) => text === '{"filter":[{"value":true}]}')).toHaveLength(1);
		} finally {
			parse.mockRestore();
		}
	});

	it("bounds retries by a per-request timeout that overrides the client timeout", async () => {
		sdkFetch.mockRejectedValue(new Error("connection refused"));
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const client = new Client({ ...options, timeout: 20, retries: 3 });

		// With the client's 20 ms as the retry budget (1.13.4) this gives up after 2 attempts.
		// The request's own 1000 ms budget now applies, so all 3 retries run.
		const error = await client.request({ method: "GET", path: "/context", timeout: 1000 }).catch((e) => e);
		warn.mockRestore();
		expect(error.name).toBe("RetryError");
		expect(sdkFetch).toHaveBeenCalledTimes(4);
	});

	it("reports an unparsable audience through the eventLogger, not the console", () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const eventLogger = jest.fn();
		const sdk = new SDK({ ...options, eventLogger });
		const context = sdk.createContextWith(
			{ units: { session_id: "u1" } },
			{
				experiments: [
					{
						id: 9,
						name: "badaud",
						iteration: 1,
						unitType: "session_id",
						seedHi: 1,
						seedLo: 2,
						split: [0.5, 0.5],
						trafficSeedHi: 3,
						trafficSeedLo: 4,
						trafficSplit: [0, 1],
						fullOnVariant: 1,
						applications: [{ name: "web" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: "{not json",
						audienceStrict: true,
						customFieldValues: null,
					},
				],
			}
		);
		// Indeterminate, as in 1.13.4, not a mismatch: the strict full-on audience still serves variant 1.
		expect(context.treatment("badaud")).toBe(1);
		expect(errorSpy).not.toHaveBeenCalled();
		const errors = eventLogger.mock.calls.filter(([, eventName]) => eventName === "error").map(([, , e]) => e);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toMatch(/^Invalid audience JSON: /);
		errorSpy.mockRestore();
	});

	it("does not build the attribute map on the no-rule, no-audience path after setAttribute", () => {
		const sdk = new SDK(options);
		const plain = {
			id: 10,
			name: "plain",
			iteration: 1,
			unitType: "session_id",
			seedHi: 1,
			seedLo: 2,
			split: [0.5, 0.5],
			trafficSeedHi: 3,
			trafficSeedLo: 4,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: null,
			audienceStrict: false,
			customFieldValues: null,
		};
		const context = sdk.createContextWith({ units: { session_id: "u1" } }, { experiments: [plain] });
		const spy = jest.spyOn(context, "_getAttributesMap");
		const first = context.treatment("plain");
		for (let i = 0; i < 50; i++) {
			context.attribute(`a${i}`, i);
			for (let j = 0; j < 5; j++) expect(context.treatment("plain")).toBe(first);
		}
		expect(spy).toHaveBeenCalledTimes(0);
		spy.mockRestore();
	});

	it.each([undefined, null])("retries like 1.13.4 when the client timeout is %p", async (timeout) => {
		sdkFetch.mockResolvedValue({
			ok: false,
			status: 503,
			statusText: "Unavailable",
			text: () => Promise.resolve(""),
		});
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const client = new Client({ ...options, timeout, retries: 2 });
		const error = await client.request({ method: "GET", path: "/context" }).catch((e) => e);
		warn.mockRestore();
		expect(error.name).toBe("RetryError");
		expect(sdkFetch).toHaveBeenCalledTimes(3);
	});

	it("generates the SDK version from package.json, so a hardcoded version cannot pass", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-version-"));
		fs.mkdirSync(path.join(dir, "scripts"));
		fs.mkdirSync(path.join(dir, "src"));
		fs.copyFileSync(
			path.join(__dirname, "../../scripts/generate-version.js"),
			path.join(dir, "scripts/generate-version.js")
		);
		fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "9.8.7-fixture.1" }));
		execFileSync(process.execPath, [path.join(dir, "scripts/generate-version.js")]);
		expect(fs.readFileSync(path.join(dir, "src/version.ts"), "utf8")).toBe(
			'export const SDK_VERSION = "9.8.7-fixture.1";\n'
		);
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("builds the default agent from the generated SDK_VERSION, not a literal", () => {
		jest.isolateModules(() => {
			jest.doMock("../version", () => ({ SDK_VERSION: "9.8.7-fixture.1" }));
			const IsolatedSDK = require("../sdk").default; // eslint-disable-line @typescript-eslint/no-var-requires
			expect(new IsolatedSDK(options).getClient().getAgent()).toBe("absmartly-javascript-sdk/9.8.7-fixture.1");
		});
		jest.dontMock("../version");
	});

	it("derives the SDK agent version from package.json, not a literal", () => {
		expect(SDK_VERSION).toBe(pkg.version);
		expect(new SDK(options).getClient().getAgent()).toBe(`absmartly-javascript-sdk/${pkg.version}`);
	});

	it("preserves explicit custom agents and the unauthenticated helper", async () => {
		sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
		const client = new Client({ ...options, agent: "customer-agent" });
		await client.get({ path: "/custom" });
		expect(sdkFetch.mock.calls[0][1].headers["X-Agent"]).toBe("customer-agent");
	});

	it.each([
		["request() without auth", (c) => c.request({ path: "/x", method: "GET" }), true],
		["request() with auth true", (c) => c.request({ path: "/x", method: "GET", auth: true }), true],
		["request() with auth false", (c) => c.request({ path: "/x", method: "GET", auth: false }), false],
		["post() with auth false", (c) => c.post({ path: "/x", auth: false }), false],
		["put() with auth false", (c) => c.put({ path: "/x", auth: false }), false],
		["getUnauthed()", (c) => c.getUnauthed({ path: "/x" }), true],
		["get() with auth false", (c) => c.get({ path: "/x", auth: false }), false],
	])("sends auth headers by default unless auth is false: %s", async (_label, call, sendsHeaders) => {
		sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		await call(new Client(options));
		warn.mockRestore();
		const request = sdkFetch.mock.calls[sdkFetch.mock.calls.length - 1][1];
		if (sendsHeaders) expect(request.headers["X-API-Key"]).toBe("k");
		else expect(request).not.toHaveProperty("headers");
	});

	it("warns once per request that auth: true is deprecated", async () => {
		sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		await new Client(options).request({ path: "/x", method: "GET", auth: true });
		expect(warn).toHaveBeenCalledWith(
			"[ABsmartly] The `auth` option is deprecated. Auth headers are now sent by default. Remove `auth: true` from your request options."
		);
		warn.mockRestore();
	});

	it("does not re-evaluate assignment rules on cached reads after a same-outcome refresh", async () => {
		const experiment = (rules) => ({
			id: 7,
			name: "ruled",
			iteration: 1,
			unitType: "session_id",
			seedHi: 1,
			seedLo: 2,
			split: [0.5, 0.5],
			trafficSeedHi: 3,
			trafficSeedLo: 4,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: null,
			audienceStrict: false,
			customFieldValues: null,
			assignmentRules: JSON.stringify(rules),
		});
		const rule = { type: "assign", variant: 1, conditions: { eq: [{ var: "country" }, { value: "US" }] } };
		const refreshed = { experiments: [experiment({ rules: [{ ...rule, name: "renamed" }] })] };
		const provider = { getContextData: () => Promise.resolve(refreshed) };
		const sdk = new SDK({ ...options, provider });
		const context = sdk.createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [experiment({ rules: [rule] })] }
		);
		context.attribute("country", "US");
		expect(context.treatment("ruled")).toBe(1);

		await context.refresh();
		expect(context.treatment("ruled")).toBe(1);
		expect(context.pending()).toBe(1);

		const spy = jest.spyOn(AudienceMatcher.prototype, "evaluateParsedRules");
		for (let i = 0; i < 100; i++) context.treatment("ruled");
		expect(spy).toHaveBeenCalledTimes(0);
		spy.mockRestore();
	});

	it("evaluates an audience once after an unrelated setAttribute, not on every cached read", () => {
		const sdk = new SDK(options);
		const experiment = {
			id: 8,
			name: "aud",
			iteration: 1,
			unitType: "session_id",
			seedHi: 1,
			seedLo: 2,
			split: [0.5, 0.5],
			trafficSeedHi: 3,
			trafficSeedLo: 4,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: JSON.stringify({ filter: [{ eq: [{ var: "country" }, { value: "US" }] }] }),
			audienceStrict: false,
			customFieldValues: null,
		};
		const context = sdk.createContextWith({ units: { session_id: "u1" } }, { experiments: [experiment] });
		context.attribute("country", "US");
		const first = context.treatment("aud");
		context.attribute("plan", "pro");

		const spy = jest.spyOn(AudienceMatcher.prototype, "evaluate");
		for (let i = 0; i < 100; i++) expect(context.treatment("aud")).toBe(first);
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	it("builds the attribute map once per setAttribute across audience experiments", () => {
		const audienceExperiment = (id, experimentName) => ({
			id,
			name: experimentName,
			iteration: 1,
			unitType: "session_id",
			seedHi: 1,
			seedLo: 2,
			split: [0.5, 0.5],
			trafficSeedHi: 3,
			trafficSeedLo: 4,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: JSON.stringify({ filter: [{ eq: [{ var: "country" }, { value: "US" }] }] }),
			audienceStrict: false,
			customFieldValues: null,
		});
		const sdk = new SDK(options);
		const context = sdk.createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [audienceExperiment(11, "aud1"), audienceExperiment(12, "aud2")] }
		);
		context.treatment("aud1");
		context.treatment("aud2");
		context.attribute("country", "US");

		const spy = jest.spyOn(context, "_getSystemAttributes");
		context.treatment("aud1");
		context.treatment("aud2");
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	it("builds the attribute map, getAttributes() and the publish list with one pass over the history", async () => {
		const publisher = { publish: jest.fn(() => Promise.resolve()) };
		const context = new SDK({ ...options, publisher }).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [] },
			{ publishDelay: -1 }
		);
		for (let i = 0; i < 5; i++) context.attribute(`a${i}`, i);
		// Count iterator use: a for...of over the history calls Symbol.iterator, forEach/map do not.
		const iterator = jest.spyOn(context._attrs, Symbol.iterator);
		const forEach = jest.spyOn(context._attrs, "forEach");
		const map = jest.spyOn(context._attrs, "map");
		context._getAttributesMap();
		context.getAttributes();
		context.track("g");
		await context.publish();
		expect(iterator).not.toHaveBeenCalled();
		expect(forEach).toHaveBeenCalledTimes(2);
		expect(map).toHaveBeenCalledTimes(1);
	});

	it("publishes with includeSystemAttributes in one pass over the history", async () => {
		const publisher = { publish: jest.fn(() => Promise.resolve()) };
		const context = new SDK({ ...options, publisher }).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [] },
			{ publishDelay: -1, includeSystemAttributes: true }
		);
		for (let i = 0; i < 5; i++) context.attribute(`a${i}`, i);
		const iterator = jest.spyOn(context._attrs, Symbol.iterator);
		const forEach = jest.spyOn(context._attrs, "forEach");
		const map = jest.spyOn(context._attrs, "map");
		context.track("g");
		await context.publish();
		expect(iterator).not.toHaveBeenCalled();
		expect(forEach).not.toHaveBeenCalled();
		expect(map).toHaveBeenCalledTimes(1);
		const names = publisher.publish.mock.calls[0][0].attributes.map((a) => a.name);
		expect(names.slice(0, 2)).toEqual(["sdk_name", "sdk_version"]);
	});

	it.each([
		["sdk_name", ["sdk_version", "sdk_name"]],
		["sdk_version", ["sdk_name", "sdk_version"]],
	])("keeps a user-set %s instead of the system one", async (userName, expectedNames) => {
		const publisher = { publish: jest.fn(() => Promise.resolve()) };
		const context = new SDK({ ...options, publisher }).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [] },
			{ publishDelay: -1, includeSystemAttributes: true }
		);
		context.attribute(userName, "mine");
		context.track("g");
		await context.publish();
		const attributes = publisher.publish.mock.calls[0][0].attributes;
		expect(attributes.map((a) => a.name)).toEqual(expectedNames);
		expect(attributes.find((a) => a.name === userName).value).toBe("mine");
	});

	it("does not read the assignment-rules JSON on cached reads", () => {
		const rules = JSON.stringify({ rules: [{ name: "all", type: "assign", variant: 1, conditions: null }] });
		const experiment = {
			id: 31,
			name: "ruled",
			iteration: 1,
			unitType: "session_id",
			seedHi: 1,
			seedLo: 2,
			split: [0.5, 0.5],
			trafficSeedHi: 3,
			trafficSeedLo: 4,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: null,
			audienceStrict: false,
			customFieldValues: null,
			assignmentRules: rules,
		};
		const context = new SDK(options).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [experiment] }
		);
		expect(context.treatment("ruled")).toBe(1);
		let reads = 0;
		const data = context._index.ruled.data;
		Object.defineProperty(data, "assignmentRules", {
			get: () => {
				reads++;
				return rules;
			},
		});
		for (let i = 0; i < 100; i++) expect(context.peek("ruled")).toBe(1);
		expect(reads).toBe(0);
	});

	it("sends no SDK headers from getContext() when auth is false, as 1.13.4 did", async () => {
		sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ experiments: [] }) });
		await new Client(options).getContext({ auth: false });
		expect(sdkFetch.mock.calls[0][1]).not.toHaveProperty("headers");
	});

	it("calls get() directly from getContext(), not a subclass's getUnauthed()", async () => {
		sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ experiments: [] }) });
		const unauthed = [];
		const gets = [];
		class LoggingClient extends Client {
			getUnauthed(requestOptions) {
				unauthed.push(requestOptions.path);
				return super.getUnauthed(requestOptions);
			}
			get(requestOptions) {
				gets.push(requestOptions.path);
				return super.get(requestOptions);
			}
		}
		await new LoggingClient(options).getContext();
		expect(unauthed).toEqual([]);
		expect(gets).toEqual(["/context"]);
		expect(sdkFetch.mock.calls[0][1].headers["X-API-Key"]).toBe("k");
	});

	it("does not change assignments when a caller edits the copy getUnits() returns", () => {
		const sdk = new SDK(options);
		const exp = {
			id: 13,
			name: "covered",
			iteration: 1,
			unitType: "user_id",
			seedHi: 1,
			seedLo: 2,
			split: [0.5, 0.5],
			trafficSeedHi: 3,
			trafficSeedLo: 4,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: null,
			audienceStrict: false,
			customFieldValues: null,
		};
		const context = sdk.createContextWith({ units: {} }, { experiments: [exp] });
		expect(context.peek("covered")).toBe(0);
		context.getUnits().user_id = "u1";
		expect(context.getUnit("user_id")).toBeUndefined();
		expect(context.treatment("covered")).toBe(0);
		expect(context._exposures.map((x) => [x.name, x.assigned])).toEqual([["covered", false]]);
		context.unit("user_id", "u1");
		const fresh = sdk.createContextWith({ units: { user_id: "u1" } }, { experiments: [exp] });
		expect(context.peek("covered")).toBe(fresh.peek("covered"));
	});

	it("treats a nested audience path under a null attribute as missing, not a mismatch, as 1.13.4 did", () => {
		const eventLogger = jest.fn();
		const experiment = {
			id: 15,
			name: "nested",
			iteration: 1,
			unitType: "session_id",
			seedHi: 3603515,
			seedLo: 233373850,
			split: [0, 1],
			trafficSeedHi: 449867249,
			trafficSeedLo: 455443629,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: JSON.stringify({ filter: [{ not: [{ eq: [{ var: "user/plan" }, { value: "free" }] }] }] }),
			audienceStrict: true,
			customFieldValues: null,
		};
		const context = new SDK({ ...options, eventLogger }).createContextWith(
			{ units: { session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec" } },
			{ experiments: [experiment] }
		);
		context.attribute("user", null);
		expect(context.treatment("nested")).toBe(1);
		expect(eventLogger.mock.calls.filter(([, eventName]) => eventName === "error")).toHaveLength(0);
	});

	it.each([true, false])("preserves null-parent equality audience behavior with strict=%p", (strict) => {
		const eventLogger = jest.fn();
		const experiment = {
			id: 15,
			name: "nested",
			iteration: 1,
			unitType: "session_id",
			seedHi: 3603515,
			seedLo: 233373850,
			split: [0, 1],
			trafficSeedHi: 449867249,
			trafficSeedLo: 455443629,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: JSON.stringify({ filter: [{ eq: [{ var: "user/plan" }, { value: "pro" }] }] }),
			audienceStrict: strict,
			customFieldValues: null,
		};
		const context = new SDK({ ...options, eventLogger }).createContextWith(
			{ units: { session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec" } },
			{ experiments: [experiment] }
		);
		context.attribute("user", null);
		expect(context.treatment("nested")).toBe(1);
		expect(eventLogger.mock.calls.find(([, eventName]) => eventName === "exposure")[2].audienceMismatch).toBe(
			false
		);
		expect(eventLogger.mock.calls.filter(([, eventName]) => eventName === "error")).toHaveLength(0);
	});

	it("skips a rule whose condition path crosses a null attribute, as main (the JS reference) does", () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const experiment = {
			id: 16,
			name: "rulenull",
			iteration: 1,
			unitType: "session_id",
			seedHi: 1,
			seedLo: 2,
			split: [0.34, 0.33, 0.33],
			trafficSeedHi: 3,
			trafficSeedLo: 4,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
				{ name: "C", config: null },
			],
			audience: null,
			audienceStrict: false,
			customFieldValues: null,
			assignmentRules: JSON.stringify({
				rules: [
					{ name: "nullplan", type: "assign", variant: 2, conditions: { null: { var: "user/plan" } } },
					{ name: "fallback", type: "assign", variant: 1, conditions: null },
				],
			}),
		};
		const context = new SDK(options).createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [experiment] }
		);
		context.attribute("user", null);
		expect(context.treatment("rulenull")).toBe(1);
		warn.mockRestore();
	});

	describe("audience and rule evaluation errors", () => {
		const strictExp = (audience) => ({
			id: 17,
			name: "aud",
			iteration: 1,
			unitType: "session_id",
			seedHi: 3603515,
			seedLo: 233373850,
			split: [0, 1],
			trafficSeedHi: 449867249,
			trafficSeedLo: 455443629,
			trafficSplit: [0, 1],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: null },
			],
			audience: JSON.stringify({ filter: audience }),
			audienceStrict: true,
			customFieldValues: null,
		});
		const uid = "e791e240fcd3df7d238cfc285f475e8152fcc0ec";

		it("evaluates semver audiences without String.prototype.startsWith (IE 10/11)", () => {
			const original = String.prototype.startsWith;
			// eslint-disable-next-line no-extend-native
			delete String.prototype.startsWith;
			try {
				const context = new SDK(options).createContextWith(
					{ units: { session_id: uid } },
					{ experiments: [strictExp([{ semver_gte: [{ var: "app_version" }, { value: "v2.0.0" }] }])] }
				);
				context.attribute("app_version", "v1.0.0");
				expect(context.treatment("aud")).toBe(0);

				const matching = new SDK(options).createContextWith(
					{ units: { session_id: uid } },
					{ experiments: [strictExp([{ semver_gte: [{ var: "app_version" }, { value: "v2.0.0" }] }])] }
				);
				matching.attribute("app_version", "v3.0.0");
				expect(matching.treatment("aud")).toBe(1);
			} finally {
				// eslint-disable-next-line no-extend-native
				String.prototype.startsWith = original;
			}
		});

		it.each([
			["an Error", () => new Error("getter boom")],
			["a TypeError", () => new TypeError("getter boom")],
			[
				"an error object marked nullParent: 1",
				() => Object.assign(new TypeError("getter boom"), { nullParent: 1 }),
			],
			[
				"a TypeError marked nullParent: true",
				() => Object.assign(new TypeError("getter boom"), { nullParent: true }),
			],
			["undefined", () => undefined],
		])(
			"fails a strict audience closed when an attribute getter throws %s, and logs one error event",
			(_label, makeError) => {
				const eventLogger = jest.fn();
				const context = new SDK({ ...options, eventLogger }).createContextWith(
					{ units: { session_id: uid } },
					{ experiments: [strictExp([{ eq: [{ var: "user/plan" }, { value: "pro" }] }])] }
				);
				const user = {};
				Object.defineProperty(user, "plan", {
					get() {
						throw makeError();
					},
				});
				context.attribute("user", user);
				expect(context.treatment("aud")).toBe(0);
				expect(context._exposures[0].audienceMismatch).toBe(true);
				expect(eventLogger.mock.calls.filter(([, eventName]) => eventName === "error")).toHaveLength(1);
			}
		);

		it("logs a null-parent audience path to the console, without an error event", () => {
			const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
			const eventLogger = jest.fn();
			const context = new SDK({ ...options, eventLogger }).createContextWith(
				{ units: { session_id: uid } },
				{ experiments: [strictExp([{ eq: [{ var: "user/plan" }, { value: "pro" }] }])] }
			);
			context.attribute("user", null);
			expect(context.treatment("aud")).toBe(1);
			expect(errorSpy).toHaveBeenCalledWith(expect.any(TypeError));
			expect(eventLogger.mock.calls.filter(([, eventName]) => eventName === "error")).toHaveLength(0);
			errorSpy.mockRestore();
		});

		it("rebuilds a cached mismatch when a later null-parent read is indeterminate, as 1.13.4 did", () => {
			const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
			const context = new SDK(options).createContextWith(
				{ units: { session_id: uid } },
				{ experiments: [strictExp([{ eq: [{ var: "user/plan" }, { value: "pro" }] }])] }
			);
			context.attribute("user", { plan: "free" });
			expect(context.peek("aud")).toBe(0);
			context.attribute("user", null);
			expect(context.peek("aud")).toBe(1);
			errorSpy.mockRestore();
		});

		it.each([true, false])(
			"keeps one exposure for a null-parent audience across unrelated setAttribute calls (strict=%p)",
			(strict) => {
				const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
				const exp = {
					...strictExp([{ eq: [{ var: "user/plan" }, { value: "pro" }] }]),
					audienceStrict: strict,
				};
				const context = new SDK(options).createContextWith(
					{ units: { session_id: uid } },
					{ experiments: [exp] },
					{ publishDelay: -1 }
				);
				context.attribute("user", null);
				expect(context.treatment("aud")).toBe(1);
				context.attribute("other", 1);
				expect(context.treatment("aud")).toBe(1);
				context.attribute("other", 2);
				expect(context.treatment("aud")).toBe(1);
				expect(context.pending()).toBe(1);
				errorSpy.mockRestore();
			}
		);

		it("logs a failing rule condition with console.warn, not console.error", () => {
			const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
			const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
			const exp = {
				...strictExp(null),
				audience: null,
				audienceStrict: false,
				assignmentRules: JSON.stringify({
					rules: [
						{
							name: "r",
							type: "assign",
							variant: 1,
							conditions: { eq: [{ var: "user/plan" }, { value: "pro" }] },
						},
					],
				}),
			};
			const context = new SDK(options).createContextWith({ units: { session_id: uid } }, { experiments: [exp] });
			context.attribute("user", null);
			context.treatment("aud");
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining("Failed to evaluate assignment rule conditions for rule r")
			);
			expect(errorSpy).not.toHaveBeenCalled();
			warn.mockRestore();
			errorSpy.mockRestore();
		});
	});

	it("returns the latest value for a repeated attribute from getAttributes()", () => {
		const context = new SDK(options).createContextWith({ units: { session_id: "u1" } }, { experiments: [] });
		context.attribute("age", 10);
		context.attribute("country", "US");
		context.attribute("age", 30);
		expect(context.getAttributes()).toEqual({ age: 30, country: "US" });
	});

	it("lets an unconditional assign rule win over excluded traffic on every read API", () => {
		const experiment = {
			id: 14,
			name: "excluded",
			iteration: 1,
			unitType: "session_id",
			seedHi: 1,
			seedLo: 2,
			split: [0.5, 0.5],
			trafficSeedHi: 3,
			trafficSeedLo: 4,
			trafficSplit: [1, 0],
			fullOnVariant: 0,
			applications: [{ name: "web" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: '{"color":"blue"}' },
			],
			audience: null,
			audienceStrict: false,
			customFieldValues: null,
			assignmentRules: JSON.stringify({ rules: [{ name: "all", type: "assign", variant: 1, conditions: null }] }),
		};
		const make = () =>
			new SDK(options).createContextWith({ units: { session_id: "u1" } }, { experiments: [experiment] });
		expect(make().peek("excluded")).toBe(1);
		expect(make().treatment("excluded")).toBe(1);
		expect(make().variableValue("color", "none")).toBe("blue");
		expect(make().peekVariableValue("color", "none")).toBe("blue");
	});

	it("publishes an app_version the user set, like any other attribute", async () => {
		const publisher = { publish: jest.fn(() => Promise.resolve()) };
		const sdk = new SDK({ ...options, publisher });
		const context = sdk.createContextWith(
			{ units: { session_id: "u1" } },
			{ experiments: [] },
			{ publishDelay: -1 }
		);
		context.attribute("app_version", "2.3.4");
		context.track("goal");
		await context.publish();
		const attributes = publisher.publish.mock.calls[0][0].attributes;
		expect(attributes).toEqual([expect.objectContaining({ name: "app_version", value: "2.3.4" })]);
	});
});
