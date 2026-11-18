import SDK from "../sdk";
import { SDK_VERSION } from "../version";
import Client from "../client";
import sdkFetch from "../fetch";
import { AudienceMatcher } from "../matcher";

jest.mock("../fetch");

const options = { endpoint: "https://collector/v1", apiKey: "k", application: "web", environment: "prod" };

describe("1.13.4 source and behaviour compatibility", () => {
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
