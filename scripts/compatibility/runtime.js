/* eslint-disable @typescript-eslint/no-var-requires, no-shadow */
/* global BigInt */
"use strict";

// Compare installed package directories, not source trees. No network is used.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CLOCK = 1700000000000;
const options = { endpoint: "http://localhost", apiKey: "key", application: "website", environment: "test" };
const contextOptions = { publishDelay: -1, refreshPeriod: 0 };
const fixture = {
	experiments: [
		{
			id: 1,
			name: "checkout",
			iteration: 1,
			unitType: "session_id",
			seedHi: 3603515,
			seedLo: 233373850,
			split: [0.5, 0.5],
			trafficSeedHi: 449867249,
			trafficSeedLo: 455443629,
			trafficSplit: [0.25, 0.75],
			fullOnVariant: 0,
			applications: [{ name: "website" }],
			variants: [
				{ name: "A", config: null },
				{ name: "B", config: '{"color":"blue"}' },
			],
			audience: null,
			customFieldValues: null,
		},
	],
};

function snapshot(value) {
	if (value instanceof Error) return { name: value.name, message: value.message };
	if (Array.isArray(value)) return value.map(snapshot);
	if (value && typeof value === "object") {
		const out = {};
		for (const key of Object.keys(value).sort()) {
			if (key === "ruleOverride" && value[key] === false) continue;
			out[key] = snapshot(value[key]);
		}
		return out;
	}
	return value;
}

function surface(exports) {
	const result = {};
	for (const key of Object.keys(exports).sort()) {
		result[key] = typeof exports[key];
	}
	return result;
}

function errorOf(fn) {
	try {
		fn();
		return null;
	} catch (error) {
		return { name: error.name, message: error.message };
	}
}

async function measure(api, hashUnit) {
	const events = [];
	const published = [];
	let providerCalls = 0;
	const provider = {
		getContextData() {
			providerCalls++;
			return Promise.resolve(JSON.parse(JSON.stringify(fixture)));
		},
	};
	const publisher = {
		publish(request) {
			published.push(snapshot(request));
			return Promise.resolve();
		},
	};
	const sdk = new api.SDK({
		...options,
		provider,
		publisher,
		eventLogger(_context, name, data) {
			events.push({ name, data: snapshot(data) });
		},
	});
	const context = sdk.createContext({ units: { session_id: "user-123" } }, contextOptions);
	const states = [{ ready: context.isReady(), pending: context.pending() }];
	const notReady = errorOf(() => context.treatment("checkout"));
	await context.ready();
	states.push({ ready: context.isReady(), pending: context.pending() });
	context.attribute("plan", "pro");
	const values = {
		peek: context.peek("checkout"),
		treatment: context.treatment("checkout"),
		repeated: context.treatment("checkout"),
		missing: context.treatment("missing"),
		variable: context.variableValue("color", "default"),
	};
	context.track("purchase", { amount: 12 });
	states.push({ pending: context.pending() });
	await context.publish();
	states.push({ pending: context.pending() });
	await context.refresh();
	context.track("second");
	await context.finalize();
	states.push({ finalized: context.isFinalized(), pending: context.pending() });
	const errors = {
		notReady,
		finalized: errorOf(() => context.treatment("checkout")),
		blankUnit: errorOf(() => sdk.createContextWith({ units: { session_id: " " } }, fixture, contextOptions)),
		invalidUnit: errorOf(() => sdk.createContextWith({ units: { session_id: {} } }, fixture, contextOptions)),
	};
	const lifecycleEvents = events.slice();
	const sweep = [];
	const uids = Array.from({ length: 256 }, (_, i) => `user-${i}`).concat([
		"😀",
		"café",
		"漢字",
		"\ud800",
		"\udc00",
		"a\ud800b",
		" padded ",
		"0",
		"-1",
		"9007199254740993",
		0,
		-1,
		1.5,
		9007199254740992,
		12345,
	]);
	for (const uid of uids) {
		const ctx = sdk.createContextWith({ units: { session_id: uid } }, fixture, contextOptions);
		sweep.push({ uid, hash: hashUnit(uid), peek: ctx.peek("checkout"), treatment: ctx.treatment("checkout") });
	}
	// The sweep must not pollute the lifecycle trace.
	return { values, states, errors, events: lifecycleEvents, published, providerCalls, sweep };
}

async function browserSurface(directory) {
	const pkg = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
	if (typeof pkg.browser !== "string") return null;
	const file = path.resolve(directory, pkg.browser);
	let request;
	const sandbox = {
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		console,
		fetch(url, opts) {
			request = { url, method: opts.method, headers: opts.headers };
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ experiments: [] }) });
		},
	};
	sandbox.self = sandbox;
	vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file, timeout: 10000 });
	if (!sandbox.absmartly || typeof sandbox.absmartly.SDK !== "function")
		throw new Error(`Browser bundle did not expose SDK: ${file}`);
	const sdk = new sandbox.absmartly.SDK({ ...options, eventLogger() {} });
	const context = sdk.createContextWith({ units: { session_id: "browser" } }, { experiments: [] }, contextOptions);
	await sdk.getClient().post({ path: "/context", body: { test: true } });
	const agent = request && request.headers && request.headers["X-Agent"];
	if (typeof agent === "string")
		request.headers["X-Agent"] = agent.replace(
			/^(absmartly-javascript-sdk)(?:\/[0-9]+\.[0-9]+\.[0-9]+(?:[-+][\w.-]+)?)?$/,
			"$1/<version>"
		);
	return snapshot({
		exports: surface(sandbox.absmartly),
		ready: context.isReady(),
		missing: context.peek("missing"),
		request,
	});
}

/** Compare two installed SDK package directories and return all measured differences. */
module.exports = async function compareRuntime(baselinePath, candidatePath) {
	const baselineDir = path.resolve(baselinePath);
	const candidateDir = path.resolve(candidatePath);
	const baseline = require(baselineDir);
	const candidate = require(candidateDir);
	const baselineExports = surface(baseline);
	const candidateExports = surface(candidate);
	const differences = [];
	function compareSubset(oldSurface, newSurface, label) {
		for (const key of Object.keys(oldSurface)) {
			if (newSurface[key] !== oldSurface[key])
				differences.push(`${label}.${key}: ${oldSurface[key]} -> ${newSurface[key]}`);
		}
	}
	function compareValues(a, b, label) {
		if (Object.is(a, b)) return;
		if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
			for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
				if (!(key in a) || !(key in b))
					differences.push(
						`${label}.${key}: ${key in a ? JSON.stringify(a[key]) : "<missing>"} -> ${
							key in b ? JSON.stringify(b[key]) : "<missing>"
						}`
					);
				else compareValues(a[key], b[key], `${label}.${key}`);
			}
		} else differences.push(`${label}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
	}
	compareSubset(baselineExports, candidateExports, "Node");
	if (baseline.default) compareSubset(surface(baseline.default), surface(candidate.default || {}), "Node default");
	const oldNow = Date.now;
	let before;
	let after;
	try {
		Date.now = () => CLOCK;
		before = await measure(baseline, require(path.join(baselineDir, "lib", "utils")).hashUnit);
		after = await measure(candidate, require(path.join(candidateDir, "lib", "utils")).hashUnit);
	} finally {
		Date.now = oldNow;
	}
	compareValues(before, after, "runtime");
	const oldBrowser = await browserSurface(baselineDir);
	const newBrowser = await browserSurface(candidateDir);
	if (oldBrowser && !newBrowser) differences.push("Candidate browser entry is missing");
	if (oldBrowser && newBrowser) {
		compareSubset(oldBrowser.exports, newBrowser.exports, "Browser");
		compareValues(
			{ ready: oldBrowser.ready, missing: oldBrowser.missing, request: oldBrowser.request },
			{ ready: newBrowser.ready, missing: newBrowser.missing, request: newBrowser.request },
			"browser"
		);
	}
	return {
		baselineExports,
		candidateExports,
		baseline: before,
		candidate: after,
		browser: { baseline: oldBrowser, candidate: newBrowser },
		errors: differences,
	};
};
