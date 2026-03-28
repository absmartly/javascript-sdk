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
});
