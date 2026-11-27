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

test("does not accept the same errors for a different type", () => {
	const otherType = ruleOverride.replace("type 'Exposure'", "type 'Goal'");
	expect(unacceptedTypeErrors(accepted.replace(ruleOverride, otherType))).toContain(otherType);
	const otherAssign = "consumer.ts(9,1): error TS2322: Type 'string | number' is not assignable to type 'boolean'.";
	expect(unacceptedTypeErrors(`${accepted}\n${otherAssign}`)).toEqual([otherAssign]);
});

test("reports an unaccepted error's own detail lines", () => {
	const other = "consumer.ts(9,1): error TS2322: Type 'Foo' is not assignable to type 'Bar'.";
	const otherDetail = "  Property 'x' is missing in type 'Foo'.";
	expect(unacceptedTypeErrors(`${accepted}\n${other}\n${otherDetail}`)).toEqual([other, otherDetail]);
});

test("reports a compiler message line that is not an error", () => {
	const message = "error: TS5083: Cannot read file 'tsconfig.json'.";
	const note = "consumer.ts(1,1): message TS6000: something unexpected";
	expect(unacceptedTypeErrors(`${accepted}\n${note}`)).toEqual([note]);
	expect(unacceptedTypeErrors(`${accepted}\n${message}`)).toEqual([message]);
});

test("reports a top-level error that matches the accepted detail text", () => {
	const topLevel = "consumer.ts(9,1): error TS2322: Type 'string' is not assignable to type 'number'.";
	expect(unacceptedTypeErrors(`${accepted}\n${topLevel}`)).toEqual([topLevel]);
});

test("does not accept another missing Exposure property", () => {
	const otherProperty = ruleOverride.replace("'ruleOverride'", "'foo'");
	expect(unacceptedTypeErrors(accepted.replace(ruleOverride, otherProperty))).toContain(otherProperty);
});
