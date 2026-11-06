import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const version: unknown = pkg.version;

if (typeof version !== "string" || version.trim().length === 0) {
	throw new Error(`package.json "version" must be a non-empty string, got ${JSON.stringify(version)}`);
}

writeFileSync("src/version.ts", `export const SDK_VERSION = ${JSON.stringify(version.trim())};\n`);
