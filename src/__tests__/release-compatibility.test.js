import SDK from "../sdk";
import { SDK_VERSION } from "../version";
import Client from "../client";
import sdkFetch from "../fetch";

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
		await client.getUnauthed({ path: "/custom", auth: true });
		expect(sdkFetch.mock.calls[1][1]).not.toHaveProperty("headers");
	});
});
