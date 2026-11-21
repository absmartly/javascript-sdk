/* eslint-disable @typescript-eslint/no-var-requires, no-shadow, no-template-curly-in-string */
/* global BigInt */
const { readFileSync } = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
const yaml = require("js-yaml");
const { majorOf, releaseTag, checkRepository } = require("../check-release");
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
	test("npm 11.6.2 parses every manual publish command as an effective dry run", () => {
		const npmVersion = /npm@(\d+\.\d+\.\d+)/.exec(job.steps.map((step) => step.run || "").join("\n"))[1];
		const effectiveDryRun = (run) => {
			const line = run.split("\n").find((l) => /^\s*npm publish\b/.test(l));
			const args = line
				.trim()
				.split(/\s+/)
				.slice(2)
				.map((arg) => arg.replace(/^"\$DIST_TAG"$/, "latest"));
			return execFileSync("npx", ["-y", `npm@${npmVersion}`, "config", "get", "dry-run", ...args], {
				encoding: "utf8",
			}).trim();
		};
		const manual = publishSteps.filter((step) => step.if && step.if.includes("workflow_dispatch"));
		expect(manual.length).toBeGreaterThan(0);
		for (const step of manual) expect(effectiveDryRun(step.run)).toBe("true");
		const live = publishSteps.filter((step) => step.if === "github.event_name == 'push'");
		expect(live.map((step) => effectiveDryRun(step.run))).toEqual(["false"]);
	}, 120000);

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
