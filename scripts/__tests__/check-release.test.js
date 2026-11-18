/* eslint-disable @typescript-eslint/no-var-requires, no-shadow */
/* global BigInt */
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

test("never puts prereleases on latest", () => {
	expect(releaseTag("1.15.0-beta.0", "1.14.0", "v1.15.0-beta.0")).toBe("beta");
	expect(releaseTag("1.14.1-rc.1", "1.14.0", "v1.14.1-rc.1")).toBe("rc");
	expect(releaseTag("2.0.0-0", "1.14.0", "v2.0.0-0")).toBe("next");
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
