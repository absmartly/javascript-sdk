/* eslint-disable @typescript-eslint/no-var-requires, no-shadow */
/* global BigInt */
const { majorOf, releaseTag } = require("../check-release");

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
