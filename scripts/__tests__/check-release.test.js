/* eslint-disable @typescript-eslint/no-var-requires, no-shadow, no-template-curly-in-string */
/* global BigInt */
const { readFileSync } = require("fs");
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
		expect(publishSteps).toHaveLength(3);
		for (const step of publishSteps) {
			expect(job.steps.indexOf(step)).toBeGreaterThan(validationIndex);
			expect(step.env.DIST_TAG).toBe("${{ steps.release.outputs.dist_tag }}");
			expect(step.run).toContain('--tag "$DIST_TAG"');
			expect(step.run).toContain("--provenance --access public");
		}
	});

	test("keeps manual runs dry and token-free trusted publishing restricted to pushes", () => {
		expect(workflow.on.push.tags).toEqual(["v*"]);
		expect(workflow.on.workflow_dispatch.inputs.use_npm_token.default).toBe(false);
		expect(workflow.permissions["id-token"]).toBe("write");
		const liveSteps = publishSteps.filter((step) => !step.run.includes("--dry-run"));
		expect(liveSteps).toHaveLength(1);
		expect(liveSteps[0].if).toBe("github.event_name == 'push'");
		expect(liveSteps[0].env.NODE_AUTH_TOKEN).toBeUndefined();
		const drySteps = publishSteps.filter((step) => step.run.includes("--dry-run"));
		expect(drySteps.map((step) => step.if)).toEqual([
			"github.event_name == 'workflow_dispatch' && !inputs.use_npm_token",
			"github.event_name == 'workflow_dispatch' && inputs.use_npm_token",
		]);
		expect(drySteps[0].env.NODE_AUTH_TOKEN).toBeUndefined();
		expect(drySteps[1].env.NODE_AUTH_TOKEN).toBe("${{ secrets.NPM_TOKEN }}");
	});
});
