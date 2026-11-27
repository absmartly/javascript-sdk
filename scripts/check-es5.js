/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const vm = require("vm");

// The arms Node (native TextEncoder) serves for this probe; IE 10 must serve the same ones.
const EXPECTED_IE10_SWITCHBACK_ARMS = [0, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2, 0];

// IE 10 lacks native Map/Set, Reflect, Object.setPrototypeOf, __proto__, TextEncoder,
// ArrayBuffer.prototype.slice, ArrayBuffer.isView and every ES2015 typed-array method; its typed
// arrays have only buffer, byteLength, byteOffset, length, set and subarray. Each probe runs the bundle
// in a fresh realm with all of these removed.
const IE10_PRELUDE = `
	delete this.Map;
	delete this.Set;
	delete this.WeakMap;
	delete this.WeakSet;
	delete this.Reflect;
	delete this.TextEncoder;
	delete Object.setPrototypeOf;
	delete Object.prototype.__proto__;
	delete ArrayBuffer.prototype.slice;
	delete ArrayBuffer.isView;
	(function () {
		var TypedArray = Object.getPrototypeOf(Uint8Array);
		var keep = ["constructor", "buffer", "byteLength", "byteOffset", "length", "set", "subarray"];
		Object.getOwnPropertyNames(TypedArray.prototype).forEach(function (name) {
			if (keep.indexOf(name) < 0) delete TypedArray.prototype[name];
		});
		Object.getOwnPropertySymbols(TypedArray.prototype).forEach(function (symbol) {
			delete TypedArray.prototype[symbol];
		});
		delete TypedArray.from;
		delete TypedArray.of;
	})();
`;

function ie10Realm(target) {
	const sandbox = {
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		Promise,
		console: { ...console, error() {} },
	};
	sandbox.self = sandbox;
	const context = vm.createContext(sandbox);
	vm.runInContext(IE10_PRELUDE, context);
	vm.runInContext(fs.readFileSync(target, "utf8"), context, { timeout: 10000 });
	return context;
}

let failed = false;
for (const file of ["absmartly.js", "absmartly.min.js"]) {
	const target = path.resolve(__dirname, "../dist", file);
	try {
		acorn.parse(fs.readFileSync(target, "utf8"), { ecmaVersion: 5 });
	} catch (error) {
		console.error(`dist/${file} is not ES5: ${error.message}`);
		failed = true;
		continue;
	}
	for (const [label, check] of [
		["legacy startup", checkIe10Startup],
		["null-parent audience", checkIe10NullParentAudience],
		["switchback", checkIe10Switchback],
	]) {
		try {
			check(ie10Realm(target));
			console.log(`IE 10 ${label} OK: dist/${file}`);
		} catch (error) {
			console.error(`dist/${file} breaks ${label} on IE 10: ${error.message}`);
			failed = true;
		}
	}
}

function checkIe10Startup(context) {
	if (vm.runInContext("typeof absmartly !== 'undefined' && typeof absmartly.SDK", context) !== "function")
		throw new Error("SDK did not load");
}

// A null-parent audience path must stay indeterminate on IE 10 (as in 1.13.4), not fail closed.
function checkIe10NullParentAudience(context) {
	const probe = `(function () {
		var errors = 0;
		var sdk = new absmartly.SDK({ endpoint: "http://x/v1", apiKey: "k", application: "web", environment: "prod",
			eventLogger: function (c, name) { if (name === "error") errors++; } });
		var exp = { id: 1, name: "aud", iteration: 1, unitType: "session_id", seedHi: 3603515, seedLo: 233373850,
			split: [0, 1], trafficSeedHi: 449867249, trafficSeedLo: 455443629, trafficSplit: [0, 1], fullOnVariant: 0,
			applications: [{ name: "web" }], variants: [{ name: "A", config: null }, { name: "B", config: null }],
			audience: JSON.stringify({ filter: [{ eq: [{ var: "user/plan" }, { value: "pro" }] }] }),
			audienceStrict: true, customFieldValues: null };
		var ctx = sdk.createContextWith({ units: { session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec" } }, { experiments: [exp] });
		ctx.attribute("user", null);
		return { variant: ctx.treatment("aud"), errors: errors };
	})()`;
	const result = vm.runInContext(probe, context);
	if (result.variant !== 1 || result.errors !== 0) {
		throw new Error(`expected variant 1 and 0 error events, got ${JSON.stringify(result)}`);
	}
}

// A switchback must resolve its cluster's scheduled arm on IE 10, the same arm Node gives (12 hourly
// periods of a 3-arm schedule).
function checkIe10Switchback(context) {
	const probe = `(function () {
		var errors = 0;
		var sdk = new absmartly.SDK({ endpoint: "http://x/v1", apiKey: "k", application: "web", environment: "prod",
			eventLogger: function (c, name) { if (name === "error") errors++; } });
		var exp = { id: 1, name: "sb", iteration: 1, unitType: "store_id", seedHi: -5, seedLo: -7,
			split: [1 / 3, 1 / 3, 1 / 3], trafficSeedHi: 1, trafficSeedLo: 2, trafficSplit: [0, 1], fullOnVariant: 0,
			applications: [{ name: "web" }], variants: [{ name: "A", config: null }, { name: "B", config: null },
			{ name: "C", config: null }], audience: null, audienceStrict: false, customFieldValues: null,
			randomizationType: "switchback", switchbackClusters: { store_id: "store_key" },
			switchbackStartAt: 1767225600000, switchbackPeriodMs: 3600000, switchbackCarryoverDurationMs: 0,
			switchbackBurnInDurationMs: 0, switchbackBurnOutDurationMs: 0, switchbackDesignType: "balanced_block",
			switchbackEstimand: "global_average_treatment_effect" };
		var arms = [];
		var now = Date.now;
		try {
			for (var period = 0; period < 12; period++) {
				Date.now = function () { return 1767225600000 + period * 3600000 + 1; };
				var ctx = sdk.createContextWith({ units: { store_id: "u" } }, { experiments: [exp] });
				ctx.attribute("store_key", "store-😀-42");
				arms.push(ctx.treatment("sb"));
			}
		} finally {
			Date.now = now;
		}
		return { arms: arms, errors: errors };
	})()`;
	const result = vm.runInContext(probe, context);
	const expected = JSON.stringify(EXPECTED_IE10_SWITCHBACK_ARMS);
	if (JSON.stringify(result.arms) !== expected || result.errors !== 0) {
		throw new Error(`expected arms ${expected} and 0 error events, got ${JSON.stringify(result)}`);
	}
}

process.exitCode = failed ? 1 : 0;
