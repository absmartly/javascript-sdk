// Constructor-merge tests for SDK and Client. Kept in a separate file from
// fixes.test.js so the file-scope jest.mock("../client") / jest.mock("../sdk")
// in that file doesn't replace these constructors with Jest doubles, which
// would make these assertions vacuous (passing without exercising the real
// _extractClientOptions / option-merge logic).

import SDK from "../sdk";
import Client from "../client";

describe("Fix #11: SDK._extractClientOptions uses includes", () => {
	it("should extract client options and pass them to the real Client", () => {
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
});

describe("Fix #33: Client constructor uses spread", () => {
	it("should merge defaults with provided options and apply them", () => {
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

	it("should use defaults when optional fields are omitted", () => {
		const client = new Client({
			endpoint: "http://test",
			environment: "prod",
			apiKey: "key123",
			application: "myapp",
		});

		expect(client.getAgent()).toBe("javascript-client");
	});
});

describe("Fix #34: SDK._contextOptions uses spread", () => {
	it("should merge custom options with defaults via the real constructor", () => {
		const sdk = new SDK({
			agent: "test",
			apiKey: "key",
			application: "app",
			endpoint: "http://localhost",
			environment: "test",
			retries: 2,
			timeout: 1234,
		});

		const client = sdk.getClient();
		expect(client).toBeInstanceOf(Client);
		expect(client.getAgent()).toBe("test");
		expect(client.getEnvironment()).toBe("test");
	});

	it("should accept application as an object", () => {
		const sdk = new SDK({
			agent: "test",
			apiKey: "key",
			application: { name: "myapp", version: "1.2.3" },
			endpoint: "http://localhost",
			environment: "prod",
		});

		expect(sdk.getClient().getApplication()).toEqual({ name: "myapp", version: "1.2.3" });
	});
});
