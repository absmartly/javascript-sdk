import { describe, expect, test } from "vitest";
import { base64UrlNoPadding, hashUnit, stringToUint8Array } from "../hashing";

describe("stringToUint8Array", () => {
	test("encodes ASCII", () => {
		const result = stringToUint8Array("abc");
		expect(Array.from(result)).toEqual([97, 98, 99]);
	});

	test("encodes multi-byte characters", () => {
		const result = stringToUint8Array("\u00e9");
		expect(Array.from(result)).toEqual([0xc3, 0xa9]);
	});

	test("encodes empty string", () => {
		const result = stringToUint8Array("");
		expect(result.length).toBe(0);
	});

	test("encodes 4-byte characters (emoji/surrogate pairs)", () => {
		const result = stringToUint8Array("\u{1F600}");
		// U+1F600 = F0 9F 98 80 in UTF-8
		expect(Array.from(result)).toEqual([0xf0, 0x9f, 0x98, 0x80]);
	});
});

describe("base64UrlNoPadding", () => {
	test("encodes empty", () => {
		expect(base64UrlNoPadding(new Uint8Array([]))).toBe("");
	});

	test("encodes 1 byte", () => {
		expect(base64UrlNoPadding(new Uint8Array([0]))).toBe("AA");
	});

	test("encodes 2 bytes", () => {
		expect(base64UrlNoPadding(new Uint8Array([0, 0]))).toBe("AAA");
	});

	test("encodes 3 bytes", () => {
		expect(base64UrlNoPadding(new Uint8Array([0, 0, 0]))).toBe("AAAA");
	});

	test("uses URL-safe characters (no +, /, =)", () => {
		const result = base64UrlNoPadding(new Uint8Array([255, 254, 253, 252, 251, 250]));
		expect(result).not.toContain("+");
		expect(result).not.toContain("/");
		expect(result).not.toContain("=");
	});
});

describe("hashUnit", () => {
	test("hashes string unit", () => {
		const result = hashUnit("test_unit");
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hashes numeric unit", () => {
		const result = hashUnit(12345);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("produces consistent results", () => {
		expect(hashUnit("abc")).toBe(hashUnit("abc"));
		expect(hashUnit(123)).toBe(hashUnit(123));
	});

	test("produces different results for different inputs", () => {
		expect(hashUnit("abc")).not.toBe(hashUnit("def"));
	});

	test("returns exactly 22 chars (MD5 = 16 bytes = 22 base64url chars)", () => {
		expect(hashUnit("a").length).toBe(22);
		expect(hashUnit("abcdefghijklmnopqrstuvwxyz").length).toBe(22);
		expect(hashUnit("bleh@absmartly.com").length).toBe(22);
		expect(hashUnit(123456789).length).toBe(22);
	});
});
