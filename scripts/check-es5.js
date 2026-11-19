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
	}
}
process.exitCode = failed ? 1 : 0;
