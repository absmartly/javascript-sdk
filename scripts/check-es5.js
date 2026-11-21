/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const vm = require("vm");

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
process.exitCode = failed ? 1 : 0;
