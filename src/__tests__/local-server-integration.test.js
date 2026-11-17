import http from "http";
import SDK from "../sdk";

// Hermetic integration test: spins up a real local HTTP server on an ephemeral
// port, points the SDK's client endpoint at it, and drives the PUBLIC SDK API so
// the REAL HTTP client performs a GET /context (createContext -> ready) and a
// PUT /context (treatment + track -> publish). Asserts the wire contract.
describe("Local server integration (real HTTP)", () => {
	let server;
	let baseUrl;
	const requests = [];
	let contextResponse = { experiments: [] };

	beforeAll((done) => {
		server = http.createServer((req, res) => {
			const chunks = [];
			req.on("data", (c) => chunks.push(c));
			req.on("end", () => {
				const bodyStr = Buffer.concat(chunks).toString("utf8");
				const record = {
					method: req.method,
					url: req.url,
					headers: req.headers,
					body: bodyStr.length > 0 ? JSON.parse(bodyStr) : undefined,
				};
				requests.push(record);

				res.setHeader("Content-Type", "application/json");
				if (req.method === "GET") {
					res.statusCode = 200;
					res.end(JSON.stringify(contextResponse));
				} else if (req.method === "PUT") {
					res.statusCode = 200;
					res.end(JSON.stringify({}));
				} else {
					res.statusCode = 405;
					res.end("{}");
				}
			});
		});

		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			baseUrl = `http://127.0.0.1:${port}`;
			done();
		});
	});

	beforeEach(() => {
		requests.length = 0;
		contextResponse = { experiments: [] };
	});

	afterAll((done) => {
		server.close(done);
		server.closeIdleConnections?.();
	});

	it("performs a real GET /context and PUT /context against a local server", async () => {
		const sdk = new SDK({
			endpoint: baseUrl,
			apiKey: "test-api-key",
			application: "www",
			environment: "development",
		});

		const context = sdk.createContext(
			{
				units: {
					session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec",
					user_id: "123456789",
				},
			},
			{ publishDelay: -1, refreshPeriod: 0 }
		);

		await context.ready();

		// --- assert the GET /context ---
		const getReq = requests.find((r) => r.method === "GET");
		expect(getReq).toBeDefined();
		const getUrl = new URL(getReq.url, baseUrl);
		expect(getUrl.pathname).toBe("/context");
		expect(getUrl.searchParams.get("application")).toBe("www");
		expect(getUrl.searchParams.get("environment")).toBe("development");
		// JS sends the full auth header set on GET too (per wire contract).
		expect(getReq.headers["x-api-key"]).toBe("test-api-key");

		// --- drive an exposure + a goal, then publish ---
		context.treatment("not_found_experiment");
		context.track("payment", { value: 99 });

		await context.publish();

		const putReq = requests.find((r) => r.method === "PUT");
		expect(putReq).toBeDefined();
		const putUrl = new URL(putReq.url, baseUrl);
		expect(putUrl.pathname).toBe("/context");
		expect(putUrl.search).toBe("");

		// --- headers ---
		expect(putReq.headers["x-api-key"]).toBe("test-api-key");
		expect(putReq.headers["x-application"]).toBe("www");
		expect(putReq.headers["x-environment"]).toBe("development");
		expect(putReq.headers["x-application-version"]).toBe("0");
		expect(putReq.headers["x-agent"]).toBeDefined();
		expect(putReq.headers["x-agent"].length).toBeGreaterThan(0);
		expect(putReq.headers["content-type"]).toMatch(/application\/json/);

		// --- body ---
		const body = putReq.body;
		expect(body.hashed).toBe(true);
		expect(Array.isArray(body.units)).toBe(true);
		expect(body.units.length).toBeGreaterThan(0);
		expect(body.units[0]).toHaveProperty("type");
		expect(body.units[0]).toHaveProperty("uid");
		expect(typeof body.publishedAt).toBe("number");
		expect(Array.isArray(body.goals)).toBe(true);
		expect(body.goals.length).toBeGreaterThan(0);
		expect(body.goals[0].name).toBe("payment");
		expect(Array.isArray(body.exposures)).toBe(true);
		expect(body.exposures.length).toBeGreaterThan(0);
	});

	it.each([
		["not set", {}, []],
		["true", { includeSystemAttributes: true }, ["sdk_name", "sdk_version"]],
	])(
		"matches an environment audience without publishing application, environment or app_version (includeSystemAttributes %s)",
		async (_, extraOptions, systemNames) => {
			contextResponse = {
				experiments: [
					{
						id: 1,
						name: "exp_environment",
						iteration: 1,
						unitType: "session_id",
						seedHi: 3603515,
						seedLo: 233373850,
						split: [0.5, 0.5],
						trafficSeedHi: 449867249,
						trafficSeedLo: 455443629,
						trafficSplit: [0.0, 1.0],
						fullOnVariant: 1,
						applications: [{ name: "www" }],
						variants: [
							{ name: "A", config: null },
							{ name: "B", config: null },
						],
						audienceStrict: true,
						audience: JSON.stringify({
							filter: [
								{ eq: [{ var: "environment" }, { value: "development" }] },
								{ eq: [{ var: "application" }, { value: "www" }] },
							],
						}),
					},
				],
			};
			const sdk = new SDK({
				endpoint: baseUrl,
				apiKey: "test-api-key",
				application: { name: "www", version: 1000003 },
				environment: "development",
			});

			const context = sdk.createContext(
				{ units: { session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec" } },
				{ publishDelay: -1, refreshPeriod: 0, ...extraOptions }
			);
			await context.ready();

			context.attribute("user_type", "vip");
			expect(context.treatment("exp_environment")).toBe(1);
			await context.publish();

			const putReq = requests.find((r) => r.method === "PUT");
			expect(putReq.body.exposures).toEqual([
				expect.objectContaining({ name: "exp_environment", variant: 1, audienceMismatch: false }),
			]);
			expect(putReq.body.attributes.map((a) => a.name)).toEqual([...systemNames, "user_type"]);
		}
	);
});
