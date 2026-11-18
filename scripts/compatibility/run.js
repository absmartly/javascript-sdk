#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, no-shadow */
/* global BigInt */
/* Run outside the package under test so imports resolve as they do for a consumer. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const child = require("child_process");
const runtime = require("./runtime");

function usage() {
	console.log(`Usage: node scripts/compatibility/run.js BASELINE_PACKAGE CANDIDATE_PACKAGE [--typescript-dir DIR] [--report FILE]

Package arguments are directories containing package.json, built JS and declarations.
Example: npm pack @absmartly/javascript-sdk@1.13.4 --ignore-scripts
         mkdir -p /tmp/sdk-baseline && tar -xzf absmartly-javascript-sdk-1.13.4.tgz -C /tmp/sdk-baseline
         npm install --prefix /tmp/sdk-baseline/package --omit=dev --ignore-scripts
         node scripts/compatibility/run.js /tmp/sdk-baseline/package . --report /tmp/sdk-compat.json

By default, three pinned TypeScript versions are installed into a temporary directory
(requires npm registry access). To use existing compilers, install npm aliases
  npm install --prefix /tmp/compat-ts --no-save --ignore-scripts \\
    typescript39@npm:typescript@3.9.10 typescript44@npm:typescript@4.4.4 typescript49@npm:typescript@4.9.5
and pass --typescript-dir /tmp/compat-ts/node_modules. No root configuration changes.
The JSON report contains all changed declaration text and all runtime export names;
it includes failures even when the command exits nonzero. Temporary files are removed.`);
}
function exec(command, args, options) {
	const result = child.spawnSync(command, args, { encoding: "utf8", ...options });
	if (result.error) throw result.error;
	return result;
}
function declarations(root) {
	const files = {};
	function visit(dir, prefix) {
		if (!fs.existsSync(dir)) return;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) visit(path.join(dir, entry.name), rel);
			else if (entry.name.endsWith(".d.ts")) files[rel] = fs.readFileSync(path.join(dir, entry.name), "utf8");
		}
	}
	visit(path.join(root, "types"), "");
	return files;
}
function typeDiff(baseline, candidate) {
	const a = declarations(baseline),
		b = declarations(candidate),
		diffs = {};
	for (const name of Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort()) {
		if (a[name] !== b[name])
			diffs[name] = {
				baseline: a[name] === undefined ? null : a[name],
				candidate: b[name] === undefined ? null : b[name],
			};
	}
	return diffs;
}
function compile(temp, compiler, packagePath, label) {
	const dir = path.join(temp, label);
	fs.mkdirSync(path.join(dir, "node_modules", "@absmartly"), { recursive: true });
	fs.symlinkSync(packagePath, path.join(dir, "node_modules", "@absmartly", "javascript-sdk"), "dir");
	fs.copyFileSync(path.join(__dirname, "consumer.ts"), path.join(dir, "consumer.ts"));
	fs.writeFileSync(
		path.join(dir, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				target: "es2017",
				module: "commonjs",
				moduleResolution: "node",
				lib: ["es2017", "dom"],
				strict: true,
				noEmit: true,
				types: [],
				skipLibCheck: false,
				esModuleInterop: true,
			},
			files: ["consumer.ts"],
		})
	);
	const result = exec(process.execPath, [
		compiler,
		"--project",
		path.join(dir, "tsconfig.json"),
		"--pretty",
		"false",
	]);
	return { passed: result.status === 0, output: (result.stdout + result.stderr).trim() };
}
async function main() {
	const args = process.argv.slice(2);
	if (args.includes("--help") || args.includes("-h")) {
		usage();
		return;
	}
	if (args.length < 2 || args[0].startsWith("-") || args[1].startsWith("-")) {
		usage();
		process.exitCode = 2;
		return;
	}
	const baseline = path.resolve(args[0]),
		candidate = path.resolve(args[1]);
	let tsDir, reportFile;
	for (let i = 2; i < args.length; i++) {
		if (args[i] === "--typescript-dir" && args[i + 1]) tsDir = path.resolve(args[++i]);
		else if (args[i] === "--report" && args[i + 1]) reportFile = path.resolve(args[++i]);
		else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
	}
	for (const pkg of [baseline, candidate]) {
		if (!fs.existsSync(path.join(pkg, "package.json"))) throw new Error(`Not an installed/built package: ${pkg}`);
	}
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-compat-"));
	const result = { packages: {}, types: {}, runtime: null, errors: [] };
	try {
		for (const [label, pkg] of [
			["baseline", baseline],
			["candidate", candidate],
		]) {
			const meta = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8"));
			result.packages[label] = { path: pkg, name: meta.name, version: meta.version };
		}
		result.declarationChanges = typeDiff(baseline, candidate);
		if (!tsDir) {
			const install = exec("npm", [
				"install",
				"--prefix",
				tmp,
				"--no-save",
				"--no-package-lock",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				"typescript39@npm:typescript@3.9.10",
				"typescript44@npm:typescript@4.4.4",
				"typescript49@npm:typescript@4.9.5",
			]);
			if (install.status !== 0)
				throw new Error(`TypeScript installation failed: ${install.stdout}${install.stderr}`);
			tsDir = path.join(tmp, "node_modules");
		}
		for (const [alias, expected] of [
			["typescript39", "3.9.10"],
			["typescript44", "4.4.4"],
			["typescript49", "4.9.5"],
		]) {
			const compilerDir = path.join(tsDir, alias);
			const actual = JSON.parse(fs.readFileSync(path.join(compilerDir, "package.json"), "utf8")).version;
			if (actual !== expected) throw new Error(`${alias} expected ${expected}, found ${actual}`);
			result.types[expected] = {};
			for (const [label, pkg] of [
				["baseline", baseline],
				["candidate", candidate],
			]) {
				const outcome = compile(tmp, path.join(compilerDir, "bin", "tsc"), pkg, `${alias}-${label}`);
				result.types[expected][label] = outcome;
				console.log(`TypeScript ${expected} ${label}: ${outcome.passed ? "PASS" : "FAIL"}`);
				if (!outcome.passed) {
					console.error(outcome.output);
					result.errors.push(`TypeScript ${expected} ${label} failed`);
				}
			}
		}
		try {
			result.runtime = await runtime(baseline, candidate);
			if (result.runtime.errors && result.runtime.errors.length) {
				result.errors.push(...result.runtime.errors.map((error) => `Runtime: ${error}`));
				for (const error of result.runtime.errors) console.error(`Runtime: ${error}`);
			}
		} catch (err) {
			result.errors.push(`Runtime: ${err.stack || err}`);
			console.error(result.errors[result.errors.length - 1]);
		}
	} catch (err) {
		result.errors.push(err.stack || String(err));
		console.error(result.errors[result.errors.length - 1]);
	} finally {
		if (reportFile) fs.writeFileSync(reportFile, `${JSON.stringify(result, null, 2)}\n`);
		fs.rmSync(tmp, { recursive: true, force: true });
	}
	console.log(
		`Changed declaration files: ${Object.keys(result.declarationChanges || {}).length}${
			reportFile ? `; report: ${reportFile}` : " (use --report for full texts)"
		}`
	);
	if (result.errors.length) process.exitCode = 1;
}
main().catch((err) => {
	console.error(err.stack || err);
	process.exitCode = 1;
});
