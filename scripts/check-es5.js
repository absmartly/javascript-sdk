/* eslint-disable @typescript-eslint/no-var-requires */
// Fails the build when a browser bundle is not plain ES5 (the IE 10 target).
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

let failed = false;
for (const file of ["absmartly.js", "absmartly.min.js"]) {
	const target = path.resolve(__dirname, "../dist", file);
	try {
		acorn.parse(fs.readFileSync(target, "utf8"), { ecmaVersion: 5 });
		console.log(`ES5 OK: dist/${file}`);
	} catch (error) {
		console.error(`dist/${file} is not ES5: ${error.message}`);
		failed = true;
	}
}
process.exitCode = failed ? 1 : 0;
