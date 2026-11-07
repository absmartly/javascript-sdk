import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { SDK } from "../index";
import { hashUnit } from "../hashing";
import { SDK_VERSION } from "../version";

// Hermetic integration tests: a real node:http server on an ephemeral port, the
// public SDK pointed at it, and the real DefaultClient + global fetch doing the
// HTTP. Nothing is stubbed, so these pin the actual wire contract of
// GET /context (create + refresh) and PUT /context (publish).

type RecordedRequest = {
	method: string;
	path: string;
	query: URLSearchParams;
	headers: IncomingHttpHeaders;
	body: Record<string, unknown> | undefined;
};

const experiment = {
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
		{ name: "B", config: '{"banner.size":"large"}' },
	],
	audience: "",
	audienceStrict: false,
	customFieldValues: null,
};

const refreshedExperiment = {
	...experiment,
	id: 2,
	name: "exp_test_new",
	variants: [
		{ name: "A", config: null },
		{ name: "B", config: null },
	],
};

describe("Local server integration (real HTTP)", () => {
	let server: Server;
	let endpoint: string;
	let requests: RecordedRequest[] = [];
	let contextResponses: unknown[] = [];

	beforeAll(async () => {
		server = createServer((req, res) => {
			const chunks: Buffer[] = [];
			req.on("data", (chunk: Buffer) => chunks.push(chunk));
			req.on("end", () => {
				const url = new URL(req.url ?? "/", "http://localhost");
				const raw = Buffer.concat(chunks).toString("utf8");
				requests.push({
					method: req.method ?? "",
					path: url.pathname,
					query: url.searchParams,
					headers: req.headers,
					body: raw.length > 0 ? JSON.parse(raw) : undefined,
				});

				res.setHeader("Content-Type", "application/json");
				if (url.pathname !== "/v1/context") {
					res.statusCode = 404;
					res.end("{}");
				} else if (req.method === "GET") {
					res.statusCode = 200;
					res.end(JSON.stringify(contextResponses.shift() ?? { experiments: [] }));
				} else if (req.method === "PUT") {
					res.statusCode = 200;
					res.end("{}");
				} else {
					res.statusCode = 405;
					res.end("{}");
				}
			});
		});

		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const { port } = server.address() as AddressInfo;
		endpoint = `http://127.0.0.1:${port}/v1`;
	});

	afterEach(() => {
		requests = [];
		contextResponses = [];
	});

	afterAll(async () => {
		server.closeAllConnections?.();
		await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
	});

	const newSDK = () =>
		new SDK({
			endpoint,
			apiKey: "test-api-key",
			application: { name: "website", version: "1.2.3" },
			environment: "development",
			agent: "integration-test-agent",
			retries: 0,
			timeout: 5000,
		});

	const expectAuthHeaders = (headers: IncomingHttpHeaders) => {
		expect(headers["x-api-key"]).toBe("test-api-key");
		expect(headers["x-agent"]).toBe("integration-test-agent");
		expect(headers["x-environment"]).toBe("development");
		expect(headers["x-application"]).toBe("website");
		expect(headers["x-application-version"]).toBe("1.2.3");
	};

	it("creates a context with GET /context and publishes exposures and goals with PUT /context", async () => {
		contextResponses.push({ experiments: [experiment] });

		const sdk = newSDK();
		const context = sdk.createContext(
			{ units: { session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec" } },
			{ publishDelay: -1, refreshPeriod: 0 }
		);

		await context.ready();
		expect(context.isFailed()).toBe(false);
		expect(context.readyError()).toBeNull();

		expect(requests).toHaveLength(1);
		const get = requests[0]!;
		expect(get.method).toBe("GET");
		expect(get.path).toBe("/v1/context");
		expect(get.query.get("application")).toBe("website");
		expect(get.query.get("environment")).toBe("development");
		expect(get.body).toBeUndefined();
		expectAuthHeaders(get.headers);

		expect(context.experiments()).toEqual(["exp_test_ab"]);
		const variant = context.treatment("exp_test_ab");
		expect(variant).toBe(1);
		context.track("payment", { amount: 99 });
		context.attribute("user_type", "returning");

		await context.publish();

		expect(requests).toHaveLength(2);
		const put = requests[1]!;
		expect(put.method).toBe("PUT");
		expect(put.path).toBe("/v1/context");
		expect([...put.query.keys()]).toEqual([]);
		expectAuthHeaders(put.headers);
		expect(put.headers["content-type"]).toMatch(/application\/json/);

		expect(put.body).toEqual({
			units: [{ type: "session_id", uid: hashUnit("e791e240fcd3df7d238cfc285f475e8152fcc0ec") }],
			hashed: true,
			publishedAt: expect.any(Number),
			sdkVersion: SDK_VERSION,
			goals: [{ name: "payment", achievedAt: expect.any(Number), properties: { amount: 99 } }],
			exposures: [
				{
					id: 1,
					name: "exp_test_ab",
					unit: "session_id",
					exposedAt: expect.any(Number),
					variant: 1,
					assigned: true,
					eligible: true,
					overridden: false,
					fullOn: false,
					custom: false,
					audienceMismatch: false,
					ruleOverride: false,
				},
			],
			attributes: [{ name: "user_type", value: "returning", setAt: expect.any(Number) }],
		});

		await context.finalize();
		expect(requests).toHaveLength(2);
	});

	it("refreshes the context with a second GET /context and picks up new experiments", async () => {
		contextResponses.push({ experiments: [experiment] }, { experiments: [experiment, refreshedExperiment] });

		const sdk = newSDK();
		const context = sdk.createContext({ units: { session_id: "abc" } }, { publishDelay: -1, refreshPeriod: 0 });
		await context.ready();
		expect(context.experiments()).toEqual(["exp_test_ab"]);

		await context.refresh();

		expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual(["GET /v1/context", "GET /v1/context"]);
		expect(requests[1]!.query.get("application")).toBe("website");
		expectAuthHeaders(requests[1]!.headers);
		expect(context.experiments()).toEqual(["exp_test_ab", "exp_test_new"]);
	});

	it("marks the context failed with a readyError when GET /context fails", async () => {
		// The server 404s anything but /v1/context; 4xx responses are not retried.
		const failing = new SDK({
			endpoint: `${endpoint}/missing`,
			apiKey: "test-api-key",
			application: "website",
			environment: "development",
			retries: 0,
			eventLogger: () => {},
		});
		const failed = failing.createContext({ units: { session_id: "abc" } });
		await expect(failed.ready()).resolves.toBe(true);
		expect(failed.isFailed()).toBe(true);
		expect(failed.readyError()).toBeInstanceOf(Error);
		expect(failed.treatment("exp_test_ab")).toBe(0);
		expect(requests.at(-1)!.path).toBe("/v1/missing/context");
	});
});
