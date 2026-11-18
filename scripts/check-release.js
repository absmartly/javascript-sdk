/* eslint-disable @typescript-eslint/no-var-requires, no-shadow */
/* global BigInt */
const { execFileSync } = require("child_process");
const { appendFileSync } = require("fs");
const { name, version } = require("../package.json");

// npm distribution tags cannot be valid semver ranges, so use v1-lts rather
// than v1 for older majors. Reject malformed versions instead of guessing.
const VERSION =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

function majorOf(value) {
	if (typeof value !== "string" || !VERSION.test(value) || /[\r\n]/.test(value)) {
		throw new Error("Invalid package version");
	}
	return BigInt(value.split(".")[0]);
}

function releaseTag(packageVersion, latestVersion, gitTag) {
	const major = majorOf(packageVersion);
	const latestMajor = majorOf(latestVersion);
	if (gitTag !== `v${packageVersion}`) {
		throw new Error("Git tag must match v<package.version>");
	}
	return major < latestMajor ? `v${major}-lts` : "latest";
}

function main() {
	const event = process.env.GITHUB_EVENT_NAME;
	if (event !== "push" && event !== "workflow_dispatch") {
		throw new Error("Unsupported workflow event");
	}
	const gitTag = event === "push" ? process.env.GITHUB_REF_NAME : `v${version}`;
	// Check the tag before making a registry request.
	majorOf(version);
	if (gitTag !== `v${version}`) {
		throw new Error("Git tag must match v<package.version>");
	}
	let latestVersion;
	try {
		latestVersion = JSON.parse(
			execFileSync(
				"npm",
				["view", `${name}@latest`, "version", "--json", "--registry=https://registry.npmjs.org/"],
				{
					encoding: "utf8",
					stdio: ["ignore", "pipe", "pipe"],
					timeout: 30000,
				}
			)
		);
	} catch (_) {
		throw new Error("Could not retrieve the latest version from the npm registry");
	}
	const distTag = releaseTag(version, latestVersion, gitTag);
	if (!process.env.GITHUB_OUTPUT) {
		throw new Error("GITHUB_OUTPUT is required");
	}
	appendFileSync(process.env.GITHUB_OUTPUT, `dist_tag=${distTag}\n`);
	console.log(`Validated ${gitTag}; npm distribution tag: ${distTag}`);
}

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}

module.exports = { majorOf, releaseTag };
