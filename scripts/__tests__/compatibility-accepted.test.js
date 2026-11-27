/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");
const { unacceptedTypeErrors, ACCEPTED_RUNTIME_DIFFERENCES } = require("../compatibility/accepted");

const ruleOverride =
	"consumer.ts(53,7): error TS2741: Property 'ruleOverride' is missing in type '{ id: number; }' but required in type 'Exposure'.";
const version = "consumer.ts(170,2): error TS2322: Type 'string | number' is not assignable to type 'number'.";
const detail = "  Type 'string' is not assignable to type 'number'.";
const accepted = [ruleOverride, version, detail, version, detail, version, detail].join("\n");

test("accepts exactly the documented 1.14.0 type breaks", () => {
	expect(unacceptedTypeErrors(accepted)).toEqual([]);
});

test("fails when an accepted type break disappears or repeats", () => {
	expect(unacceptedTypeErrors("")).toHaveLength(2);
	expect(unacceptedTypeErrors([version, version, version].join("\n"))).toHaveLength(1);
	expect(unacceptedTypeErrors(`${accepted}\n${version}`)).toHaveLength(1);
});

test("fails on any other type error", () => {
	const other = "consumer.ts(9,1): error TS2305: Module has no exported member 'Context'.";
	expect(unacceptedTypeErrors(`${accepted}\n${other}`)).toEqual([other]);
});

test("accepts only the emoji UID's hash and variant change in the runtime sweep", () => {
	const sweep = ACCEPTED_RUNTIME_DIFFERENCES.filter((line) => line.startsWith("runtime.sweep."));
	expect(sweep.map((line) => line.split(":")[0])).toEqual([
		"runtime.sweep.256.hash",
		"runtime.sweep.256.peek",
		"runtime.sweep.256.treatment",
	]);
});

test("the runtime sweep records each UID's unit hash, and UID 256 is the emoji", () => {
	const source = fs.readFileSync(path.join(__dirname, "../compatibility/runtime.js"), "utf8");
	expect(source).toMatch(/sweep\.push\(\{ uid, hash: hashUnit\(uid\),/);
	expect(source).toMatch(/Array\.from\(\{ length: 256 \}, \(_, i\) => `user-\$\{i\}`\)\.concat\(\[\s*"😀",/);
});
