/* eslint-disable @typescript-eslint/no-var-requires, no-shadow, no-template-curly-in-string */
/* global BigInt */
const { readFileSync } = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
const yaml = require("js-yaml");
const { majorOf, releaseTag, checkRepository, compareVersions } = require("../check-release");
const pkg = require("../../package.json");

test("uses a non-semver lts tag for older major releases", () => {
	expect(releaseTag("1.14.0", "2.0.0", "v1.14.0")).toBe("v1-lts");
});

test("uses latest for equal or newer majors", () => {
	expect(releaseTag("1.14.0", "1.13.0", "v1.14.0")).toBe("latest");
	expect(releaseTag("2.0.0", "1.14.0", "v2.0.0")).toBe("latest");
});

test("rejects mismatched tags and malformed registry versions", () => {
	expect(() => releaseTag("1.14.0", "2.0.0", "v1.13.0")).toThrow();
	for (const value of ["", "2", "02.0.0", "2.0.0-01", null, {}, "2.0.0\n"]) {
		expect(() => releaseTag("1.14.0", value, "v1.14.0")).toThrow();
	}
});

test("accepts valid prerelease and build metadata", () => {
	expect(majorOf("2.0.0-rc.1+build.5")).toBe(2n);
});

test.each(["alpha", "ALPHA", "beta", "Beta", "rc", "RC", "next", "NeXt"])(
	"normalizes the supported prerelease channel %s",
	(id) => {
		const version = `2.0.0-${id}.1+build.5`;
		expect(releaseTag(version, "1.14.0", `v${version}`)).toBe(id.toLowerCase());
	}
);

test.each(["latest", "LATEST", "v1", "V1", "0", "123", "preview", "beta1", "alpha-beta"])(
	"maps unsupported prerelease channel %s to next, never latest or an invalid npm tag",
	(id) => {
		const version = `2.0.0-${id}.0`;
		for (const latest of ["1.14.0", "2.0.0", "3.0.0"]) {
			expect(releaseTag(version, latest, `v${version}`)).toBe("next");
		}
	}
);

test.each(["1.15.0", "latest", "v1", "v1.14.0", "v1.15.0\n", "v1.15.0-beta.0"])(
	"rejects invalid or mismatched git tag %j",
	(tag) => {
		expect(() => releaseTag("1.15.0", "1.14.0", tag)).toThrow(/Git tag must match/);
	}
);

test.each(["1.15", "01.15.0", "1.15.0-01", "1.15.0-beta_1", "1.15.0\n"])(
	"rejects malformed package version %j",
	(version) => {
		expect(() => releaseTag(version, "1.14.0", `v${version}`)).toThrow(/Invalid package version/);
	}
);

test("publishes a stable release over a prerelease of the same version as latest", () => {
	for (const latest of ["1.14.0-rc.1", "1.14.0-beta.1", "1.14.0-alpha", "1.14.0-0", "1.14.0-rc.1+build.5"]) {
		expect(releaseTag("1.14.0", latest, "v1.14.0")).toBe("latest");
	}
	expect(() => releaseTag("1.13.9", "1.14.0-rc.1", "v1.13.9")).toThrow(/not newer than latest/);
});

// The SemVer 2.0.0 section 11 example, ascending, plus build metadata and hyphenated identifiers.
const SEMVER_ORDER = [
	"1.0.0-alpha",
	"1.0.0-alpha.1",
	"1.0.0-alpha.beta",
	"1.0.0-beta",
	"1.0.0-beta.2",
	"1.0.0-beta.11",
	"1.0.0-rc.1",
	"1.0.0-rc-1.2",
	"1.0.0-rc-1.10",
	"1.0.0",
	"1.0.1-0",
	"1.0.1",
];

test("orders versions by SemVer precedence", () => {
	for (let i = 0; i < SEMVER_ORDER.length; i++) {
		for (let j = 0; j < SEMVER_ORDER.length; j++) {
			expect([SEMVER_ORDER[i], SEMVER_ORDER[j], compareVersions(SEMVER_ORDER[i], SEMVER_ORDER[j])]).toEqual([
				SEMVER_ORDER[i],
				SEMVER_ORDER[j],
				Math.sign(i - j),
			]);
		}
	}
});

test("ignores build metadata when comparing versions", () => {
	expect(compareVersions("1.0.0+build.2", "1.0.0+build.1")).toBe(0);
	expect(compareVersions("1.0.0-rc.1+build.9", "1.0.0-rc.1")).toBe(0);
	expect(compareVersions("1.0.0+build-1", "1.0.0-rc.1")).toBe(1);
});

test("compares numeric prerelease identifiers by value, beyond Number precision", () => {
	expect(compareVersions("1.0.0-9007199254740993", "1.0.0-9007199254740992")).toBe(1);
	expect(compareVersions("1.0.0-10", "1.0.0-9")).toBe(1);
});

test("refuses an older same-major release instead of moving latest back", () => {
	expect(() => releaseTag("1.13.5", "1.14.0", "v1.13.5")).toThrow(/not newer than latest/);
	expect(() => releaseTag("1.14.0", "1.14.0", "v1.14.0")).toThrow(/not newer than latest/);
	expect(releaseTag("1.14.1", "2.0.0", "v1.14.1")).toBe("v1-lts");
});

test("package.json repository matches this repo, as npm provenance requires", () => {
	expect(() => checkRepository(pkg.repository, "absmartly/javascript-sdk")).not.toThrow();
	expect(() => checkRepository(undefined, "absmartly/javascript-sdk")).toThrow(/repository.url/);
	expect(() => checkRepository(pkg.repository, "someone/fork")).toThrow(/repository.url/);
});

describe("publish workflow", () => {
	const workflow = yaml.load(readFileSync(path.join(__dirname, "../../.github/workflows/publish.yml"), "utf8"));
	const job = workflow.jobs.publish;
	const publishSteps = job.steps.filter((step) => /npm publish\b/.test(step.run || ""));

	test("pins every action to a commit SHA, since the job can mint an OIDC token", () => {
		for (const step of job.steps.filter((step) => step.uses)) {
			expect(step.uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
		}
	});

	// Node 22 aborted context.test.js and left Jest waiting for 30+ minutes (v1.14.0, run 45978491550).
	test("builds on the .nvmrc Node version, as CI does, and fails a stalled build in minutes", () => {
		const setup = job.steps.find((step) => /actions\/setup-node@/.test(step.uses || ""));
		expect(setup.with["node-version-file"]).toBe(".nvmrc");
		expect(setup.with["node-version"]).toBeUndefined();
		expect(setup.with["registry-url"]).toBe("https://registry.npmjs.org");
		const build = job.steps.find((step) => step.run === "npm run build");
		expect(build["timeout-minutes"]).toBeGreaterThan(0);
		expect(build["timeout-minutes"]).toBeLessThanOrEqual(15);
		const ci = yaml.load(readFileSync(path.join(__dirname, "../../.github/workflows/build.yml"), "utf8"));
		const ciSetup = ci.jobs.build.steps.find((step) => /actions\/setup-node@/.test(step.uses || ""));
		expect(ciSetup.with["node-version-file"]).toBe(setup.with["node-version-file"]);
	});

	test("serializes all releases with one fixed package-wide lock without cancelling a running publish", () => {
		expect(Object.keys(workflow.jobs)).toEqual(["publish"]);
		expect(job.concurrency).toEqual({
			group: "npm-publish-absmartly-javascript-sdk",
			"cancel-in-progress": false,
		});
		expect(job.environment).toBe("npm");
	});

	test("validates the registry and tag inside the locked job before every publish", () => {
		const validationIndex = job.steps.findIndex((step) => step.run === "node scripts/check-release.js");
		expect(validationIndex).toBeGreaterThanOrEqual(0);
		expect(job.steps[validationIndex].id).toBe("release");
		expect(job.steps[validationIndex].if).toBeUndefined();
		expect(publishSteps).toHaveLength(2);
		for (const step of publishSteps) {
			expect(job.steps.indexOf(step)).toBeGreaterThan(validationIndex);
			expect(step.env.DIST_TAG).toBe("${{ steps.release.outputs.dist_tag }}");
			expect(step.run).toContain('--tag "$DIST_TAG"');
			expect(step.run).toContain("--provenance --access public");
		}
	});

	// Asks the workflow's pinned npm how it parses each publish command's flags, so a later negating
	// flag (for example --no-dry-run after --dry-run) is caught, not just the presence of --dry-run.
	const pinnedNpm = /npm@(\d+\.\d+\.\d+)/.exec(job.steps.map((step) => step.run || "").join("\n"))[1];
	// Needs the pinned npm from the registry or cache. Local offline builds skip it; in CI it always runs,
	// so a registry failure there fails the gate instead of silently skipping it.
	let pinnedNpmAvailable = true;
	try {
		execFileSync("npx", ["-y", `npm@${pinnedNpm}`, "--version"], {
			encoding: "utf8",
			stdio: "pipe",
			timeout: 30000,
		});
	} catch (_) {
		pinnedNpmAvailable = false;
	}
	(pinnedNpmAvailable || process.env.CI ? test : test.skip)(
		"npm 11.6.2 parses every manual publish command as an effective dry run",
		() => {
			const npmVersion = pinnedNpm;
			const effectiveDryRun = (run) => {
				const lines = run.split("\n").filter((l) => /\bnpm\s+publish\b/.test(l));
				expect(lines).toHaveLength(1);
				const line = lines[0];
				const args = line
					.trim()
					.split(/\s+/)
					.slice(2)
					.map((arg) => arg.replace(/^"\$DIST_TAG"$/, "latest"));
				// npm exports npm_config_* to scripts (e.g. npm_config_dry_run=true under `npm pack --dry-run`);
				// drop them so only the flags in the workflow command decide the answer.
				const env = {};
				for (const [key, value] of Object.entries(process.env)) {
					if (!/^npm_config_/i.test(key)) env[key] = value;
				}
				return execFileSync("npx", ["-y", `npm@${npmVersion}`, "config", "get", "dry-run", ...args], {
					encoding: "utf8",
					env,
					timeout: 30000,
				}).trim();
			};
			const manual = publishSteps.filter((step) => step.if && step.if.includes("workflow_dispatch"));
			expect(manual.length).toBeGreaterThan(0);
			for (const step of manual) expect(effectiveDryRun(step.run)).toBe("true");
			const live = publishSteps.filter((step) => step.if === "github.event_name == 'push'");
			expect(live.map((step) => effectiveDryRun(step.run))).toEqual(["false"]);
		},
		120000
	);

	// The dry-run probe above inspects one command per step, so each publish step must be exactly one
	// single-line `npm publish` command with plain flags: no second command, separator or substitution.
	test("each publish step runs exactly one npm publish command", () => {
		for (const step of job.steps.filter((s) => /\bnpm\s+publish\b/.test(s.run || ""))) {
			expect({ step: step.name, run: step.run.trim() }).toEqual({
				step: step.name,
				run: expect.stringMatching(/^npm publish(?: --[a-z-]+(?: [a-z]+)?)+ --tag "\$DIST_TAG"$/),
			});
		}
	});

	test("keeps manual runs to one dry-run preflight and publishes only on a pushed tag, with no token", () => {
		expect(workflow.on.push.tags).toEqual(["v*"]);
		expect(workflow.on.workflow_dispatch).toBeNull();
		expect(workflow.permissions["id-token"]).toBe("write");
		expect(publishSteps).toHaveLength(2);
		expect(publishSteps.map((step) => step.if)).toEqual([
			"github.event_name == 'workflow_dispatch'",
			"github.event_name == 'push'",
		]);
		for (const step of publishSteps) expect(step.env.NODE_AUTH_TOKEN).toBeUndefined();
		expect(JSON.stringify(workflow)).not.toContain("NPM_TOKEN");
	});
});
