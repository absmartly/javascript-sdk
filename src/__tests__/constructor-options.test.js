// Constructor option-merging tests for SDK and Client.
//
// These deliberately use the real SDK and Client constructors (no jest.mock),
// so they exercise the actual _extractClientOptions / option-merge logic
// rather than Jest doubles, which would make the assertions vacuous.

import SDK from "../sdk";
import Client from "../client";

describe("SDK and Client constructor option merging", () => {
	it("should extract client options from SDK options and pass them to the real Client", () => {
		const sdk = new SDK({
			agent: "test-agent",
			apiKey: "key",
			application: "app",
			endpoint: "http://localhost",
			environment: "test",
			timeout: 5000,
		});

		const client = sdk.getClient();
		expect(client).toBeInstanceOf(Client);
		expect(client.getAgent()).toBe("test-agent");
		expect(client.getEnvironment()).toBe("test");
		expect(client.getApplication()).toEqual({ name: "app", version: 0 });
	});

	it("should accept the SDK application option as an object", () => {
		const sdk = new SDK({
			agent: "test",
			apiKey: "key",
			application: { name: "myapp", version: "1.2.3" },
			endpoint: "http://localhost",
			environment: "prod",
		});

		expect(sdk.getClient().getApplication()).toEqual({ name: "myapp", version: "1.2.3" });
	});

	it("should merge provided Client options with the defaults", () => {
		const client = new Client({
			endpoint: "http://test",
			agent: "custom-agent",
			environment: "prod",
			apiKey: "key123",
			application: "myapp",
			timeout: 10000,
		});

		expect(client.getAgent()).toBe("custom-agent");
		expect(client.getEnvironment()).toBe("prod");
		expect(client.getApplication()).toEqual({ name: "myapp", version: 0 });
	});

	it("should fall back to the default agent when it is omitted", () => {
		const client = new Client({
			endpoint: "http://test",
			environment: "prod",
			apiKey: "key123",
			application: "myapp",
		});

		expect(client.getAgent()).toBe("javascript-client");
	});
});
