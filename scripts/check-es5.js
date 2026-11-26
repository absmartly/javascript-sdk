/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const vm = require("vm");

// The arms Node (native TextEncoder) serves for this probe; IE 10 must serve the same ones.
const EXPECTED_IE10_SWITCHBACK_ARMS = [0, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2, 0];

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
	try {
		const sandbox = {
			console,
			setTimeout,
			clearTimeout,
			setInterval,
			clearInterval,
			Promise,
			Map: undefined,
			Set: undefined,
			WeakMap: undefined,
			WeakSet: undefined,
		};
		sandbox.self = sandbox;
		vm.runInNewContext(fs.readFileSync(target, "utf8"), sandbox, { timeout: 10000 });
		if (typeof sandbox.absmartly?.SDK !== "function")
			throw new Error("SDK did not load without native collections");
		console.log(`ES5 and legacy startup OK: dist/${file}`);
	} catch (error) {
		console.error(`dist/${file} does not start without native Map/Set: ${error.message}`);
		failed = true;
		continue;
	}
	try {
		checkIe10NullParentAudience(target);
		console.log(`IE 10 null-parent audience OK: dist/${file}`);
	} catch (error) {
		console.error(`dist/${file} breaks a null-parent audience on IE 10: ${error.message}`);
		failed = true;
	}
	try {
		checkIe10Switchback(target);
		console.log(`IE 10 switchback OK: dist/${file}`);
	} catch (error) {
		console.error(`dist/${file} breaks a switchback on IE 10: ${error.message}`);
		failed = true;
	}
}

// IE 10 has no Reflect, Object.setPrototypeOf or __proto__. A null-parent audience path must stay
// indeterminate there (as in 1.13.4), not fail closed. Runs the bundle in a fresh realm with those removed.
function checkIe10NullParentAudience(target) {
	const prelude = `
		delete this.Reflect;
		delete Object.setPrototypeOf;
		delete Object.prototype.__proto__;
	`;
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
	vm.runInContext(prelude, context);
	vm.runInContext(fs.readFileSync(target, "utf8"), context, { timeout: 10000 });
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
// IE 10 has no TextEncoder and no ArrayBuffer.prototype.slice. A switchback must still resolve its
// cluster's scheduled arm there, the same arm Node gives (12 hourly periods of a 3-arm schedule).
function checkIe10Switchback(target) {
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
	vm.runInContext("delete this.TextEncoder; delete ArrayBuffer.prototype.slice;", context);
	vm.runInContext(fs.readFileSync(target, "utf8"), context, { timeout: 10000 });
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
