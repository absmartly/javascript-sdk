/* eslint-disable @typescript-eslint/no-var-requires, no-shadow */
/* global BigInt */
const { execFileSync } = require("child_process");
const { appendFileSync } = require("fs");
const { name, version, repository } = require("../package.json");

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

function compareCore(a, b) {
	const x = a.split(/[-+]/)[0].split(".").map(BigInt);
	const y = b.split(/[-+]/)[0].split(".").map(BigInt);
	for (let i = 0; i < 3; i++) {
		if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
	}
	return 0;
}

// Prereleases use alpha, beta, rc or next (case-insensitive), with all other ids mapped to next.
// A stable release goes to "latest" only when it is newer than the current latest; an older major
// goes to v<major>-lts, and an older version in the same major line is refused.
function releaseTag(packageVersion, latestVersion, gitTag) {
	const major = majorOf(packageVersion);
	const latestMajor = majorOf(latestVersion);
	if (gitTag !== `v${packageVersion}`) {
		throw new Error("Git tag must match v<package.version>");
	}
	const prerelease = packageVersion.split("+")[0].split("-").slice(1).join("-");
	if (prerelease) {
		const id = prerelease.split(".")[0].toLowerCase();
		return ["alpha", "beta", "rc", "next"].includes(id) ? id : "next";
	}
	if (major < latestMajor) return `v${major}-lts`;
	if (compareCore(packageVersion, latestVersion) <= 0) {
		throw new Error(`${packageVersion} is not newer than latest ${latestVersion}; choose a dist tag manually`);
	}
	return "latest";
}

// npm provenance requires package.json repository.url to name the repository the workflow runs in.
function checkRepository(repo, githubRepository) {
	const url = repo && typeof repo === "object" ? repo.url : repo;
	const match = typeof url === "string" && /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
	if (!match || !githubRepository || match[1].toLowerCase() !== githubRepository.toLowerCase()) {
		throw new Error(`package.json repository.url must point at github.com/${githubRepository}`);
	}
}

function main() {
	const event = process.env.GITHUB_EVENT_NAME;
	if (event !== "push" && event !== "workflow_dispatch") {
		throw new Error("Unsupported workflow event");
	}
	const gitTag = event === "push" ? process.env.GITHUB_REF_NAME : `v${version}`;
	checkRepository(repository, process.env.GITHUB_REPOSITORY);
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

module.exports = { majorOf, releaseTag, checkRepository };
