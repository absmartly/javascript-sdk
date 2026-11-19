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
	beforeEach(() => {
		sdkFetch.mockReset();
	});

	it("keeps the live units map and released error strings", async () => {
		const sdk = new SDK(options);
		const context = sdk.createContextWith({ units: { user: "one" } }, { experiments: [] });
		const units = context.getUnits();
		units.session = "two";
		expect(context.getUnit("session")).toBe("two");
		expect(context.getUnits()).toBe(units);
		await context.finalize();
		expect(() => context.treatment("e")).toThrow("ABSmartly Context is finalized.");
	});

	it("accepts a released duck-typed custom client without new getters", () => {
		const client = { getContext: () => Promise.resolve({ experiments: [] }), publish: () => Promise.resolve() };
		const sdk = new SDK({ ...options, client });
		const context = sdk.createContextWith({ units: { user: "one" } }, { experiments: [] });
		expect(context.isReady()).toBe(true);
		expect(context.treatment("e")).toBe(0);
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

	it("logs an unparsable audience to the console as 1.13.4 did, without a logger error event", () => {
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
						fullOnVariant: 0,
						applications: [{ name: "web" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audience: "{not json",
						audienceStrict: false,
						customFieldValues: null,
					},
				],
			}
		);
		context.treatment("badaud");
		expect(errorSpy).toHaveBeenCalledWith(expect.any(SyntaxError));
		expect(eventLogger.mock.calls.filter(([, eventName]) => eventName === "error")).toHaveLength(0);
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
		["request() without auth", (c) => c.request({ path: "/x", method: "GET" }), false],
		["request() with auth true", (c) => c.request({ path: "/x", method: "GET", auth: true }), true],
		["post() with auth false", (c) => c.post({ path: "/x", auth: false }), true],
		["put() with auth false", (c) => c.put({ path: "/x", auth: false }), true],
		["getUnauthed()", (c) => c.getUnauthed({ path: "/x" }), false],
		["getUnauthed() with auth true", (c) => c.getUnauthed({ path: "/x", auth: true }), true],
		["get() with auth false", (c) => c.get({ path: "/x", auth: false }), false],
	])("keeps the 1.13.4 auth header rule for %s", async (_label, call, sendsHeaders) => {
		sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
		await call(new Client(options));
		const request = sdkFetch.mock.calls[sdkFetch.mock.calls.length - 1][1];
		if (sendsHeaders) expect(request.headers["X-API-Key"]).toBe("k");
		else expect(request).not.toHaveProperty("headers");
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
		// The refreshed rules JSON differs (an extra rule name) but still gives variant 1.
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

	it("routes getContext() through a subclass's getUnauthed() override", async () => {
		sdkFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ experiments: [] }) });
		const seen = [];
		class LoggingClient extends Client {
			getUnauthed(requestOptions) {
				seen.push(requestOptions.path);
				return super.getUnauthed(requestOptions);
			}
		}
		await new LoggingClient(options).getContext();
		expect(seen).toEqual(["/context"]);
		expect(sdkFetch.mock.calls[0][1].headers["X-API-Key"]).toBe("k");
	});

	describe("live units map additions", () => {
		const liveExp = (extra) => ({
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
			...extra,
		});
		const splitRules = JSON.stringify({
			rules: [{ name: "s", type: "split", percentages: "0/100", conditions: null }],
		});

		it("re-resolves a peeked missing-unit split rule once the live map gains the unit", () => {
			const context = new SDK(options).createContextWith(
				{ units: {} },
				{ experiments: [liveExp({ assignmentRules: splitRules })] }
			);
			expect(context.peek("covered")).toBe(0);
			context.getUnits().user_id = "u1";
			expect(context.peek("covered")).toBe(1);
		});

		it("matches unit() for a holdout-covered experiment peeked before the unit existed", () => {
			const holdout = {
				id: 99,
				name: "h",
				iteration: 1,
				unitType: "user_id",
				seedHi: 1,
				seedLo: 2,
				split: [0, 1],
			};
			const data = { experiments: [liveExp({ holdoutIds: [99] })], holdouts: [holdout] };
			const viaUnit = new SDK(options).createContextWith({ units: {} }, data);
			viaUnit.peek("covered");
			viaUnit.unit("user_id", "u1");
			viaUnit.treatment("covered");
			const viaMap = new SDK(options).createContextWith({ units: {} }, data);
			viaMap.peek("covered");
			viaMap.getUnits().user_id = "u1";
			viaMap.treatment("covered");
			const shape = (c) => c._exposures.map((x) => [x.name, x.variant, x.assigned]);
			expect(shape(viaMap)).toEqual(shape(viaUnit));
		});

		it("re-resolves via the live map after revalidation turns an assignment into a missing-unit pin", () => {
			const rules = JSON.stringify({
				rules: [
					{
						name: "us",
						type: "assign",
						variant: 0,
						conditions: { eq: [{ var: "country" }, { value: "US" }] },
					},
					{
						name: "gb",
						type: "split",
						percentages: "0/100",
						conditions: { eq: [{ var: "country" }, { value: "GB" }] },
					},
				],
			});
			const sequence = (setUnit) => {
				const context = new SDK(options).createContextWith(
					{ units: {} },
					{ experiments: [liveExp({ assignmentRules: rules })] }
				);
				context.attribute("country", "US");
				expect(context.peek("covered")).toBe(0);
				context.attribute("country", "GB");
				expect(context.peek("covered")).toBe(0);
				setUnit(context);
				return context.peek("covered");
			};
			expect(sequence((context) => context.unit("user_id", "u1"))).toBe(1);
			expect(
				sequence((context) => {
					context.getUnits().user_id = "u1";
				})
			).toBe(1);
		});

		it("keeps the cached assignment while the unit is still missing", () => {
			const context = new SDK(options).createContextWith(
				{ units: {} },
				{ experiments: [liveExp({ assignmentRules: splitRules })] }
			);
			context.peek("covered");
			const first = context._assignments.covered;
			context.peek("covered");
			expect(context._assignments.covered).toBe(first);
		});

		it("does no live-units work on cached reads when nothing was resolved without its unit", () => {
			const context = new SDK(options).createContextWith(
				{ units: { user_id: "u1" } },
				{ experiments: [liveExp({})] }
			);
			context.peek("covered");
			const cached = context._assignments.covered;
			let reads = 0;
			let value = cached.isRuleMissingUnit;
			Object.defineProperty(cached, "isRuleMissingUnit", {
				get: () => {
					reads++;
					return value;
				},
				set: (v) => {
					value = v;
				},
			});
			for (let i = 0; i < 50; i++) context.peek("covered");
			expect(context._missingUnitPins).toBe(0);
			expect(reads).toBe(0);
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

	it("invalidates a cached missing-unit assignment when the live units map gains the unit", () => {
		const sdk = new SDK(options);
		const holdout = { id: 99, name: "h", iteration: 1, unitType: "user_id", seedHi: 1, seedLo: 2, split: [1, 0] };
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
			holdoutIds: [99],
		};
		const context = sdk.createContextWith({ units: {} }, { experiments: [exp], holdouts: [holdout] });
		expect(context.peek("covered")).toBe(0);
		context.getUnits().user_id = "u1";
		context.treatment("covered");
		expect(context.pending()).toBeGreaterThan(0);
	});

	describe("a released duck-typed custom client without the new getters", () => {
		const legacyClient = () => ({
			getContext: () => Promise.resolve({ experiments: [] }),
			publish: jest.fn(() => Promise.resolve()),
		});
		const strictCountryExperiment = {
			id: 1,
			name: "exp",
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
			audience: JSON.stringify({ filter: [{ eq: [{ var: "country" }, { value: "US" }] }] }),
			audienceStrict: true,
			customFieldValues: null,
		};

		it("still evaluates audiences when only getApplication exists", () => {
			const client = { ...legacyClient(), getApplication: () => ({ name: "web", version: 0 }) };
			const sdk = new SDK({ ...options, client });
			const context = sdk.createContextWith(
				{ units: { session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec" } },
				{ experiments: [strictCountryExperiment] }
			);
			context.attribute("country", "US");
			expect(context.treatment("exp")).toBe(1);
		});

		it.each(["application", "environment"])("uses %s when only its getter exists", (attributeName) => {
			const client = legacyClient();
			if (attributeName === "application") client.getApplication = () => ({ name: "web", version: 0 });
			else client.getEnvironment = () => "prod";
			const sdk = new SDK({ ...options, client });
			const value = attributeName === "application" ? "web" : "prod";
			const exp = {
				...strictCountryExperiment,
				audience: JSON.stringify({ filter: [{ eq: [{ var: attributeName }, { value }] }] }),
			};
			const context = sdk.createContextWith({ units: { session_id: "u1" } }, { experiments: [exp] });
			expect(context.treatment("exp")).toBe(1);
		});

		it("still evaluates audiences", () => {
			const sdk = new SDK({ ...options, client: legacyClient() });
			const context = sdk.createContextWith(
				{ units: { session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec" } },
				{ experiments: [strictCountryExperiment] }
			);
			context.attribute("country", "US");
			expect(context.treatment("exp")).toBe(1);
		});

		it("publishes sdk_version but no empty sdk_name", async () => {
			const client = legacyClient();
			const sdk = new SDK({ ...options, client });
			const context = sdk.createContextWith(
				{ units: { session_id: "u" } },
				{ experiments: [] },
				{ includeSystemAttributes: true, publishDelay: -1 }
			);
			context.track("goal");
			await context.publish();
			const names = client.publish.mock.calls[0][0].attributes.map((a) => a.name);
			expect(names).toEqual(["sdk_version"]);
		});
	});
});
