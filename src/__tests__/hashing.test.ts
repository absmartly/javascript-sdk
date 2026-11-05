import { afterEach, describe, expect, test, vi } from "vitest";
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

describe("hashUnit cross-SDK fixtures", () => {
	test("hashes astral/multibyte characters to the canonical cross-SDK values", () => {
		// Characters outside the BMP are stored as UTF-16 surrogate pairs and must
		// encode to 4-byte UTF-8; these canonical hashes are shared across all SDKs.
		expect(hashUnit("😀")).toBe("KgLqw51xanDs83V5GFkntg");
		expect(hashUnit("😀😁")).toBe("ZJuDalvUWRJnVtkspj-2bQ");
		expect(hashUnit("世界你好")).toBe("v2CJG7YcjjWncKOSCzF2GA");
		expect(hashUnit("user_世界_123")).toBe("SCgk4OzXlFMvo1UMsP88fA");
	});
});

describe("stringToUint8Array unmatched surrogates", () => {
	// Unmatched surrogate code units are not valid UTF-8 code points; both TextEncoder
	// and the manual fallback must emit U+FFFD (ef bf bd) for each one.
	const FFFD = [0xef, 0xbf, 0xbd];
	const testCases: [string, string, number[]][] = [
		["lone high surrogate at end of string", "\uD800", FFFD],
		["lone low surrogate", "\uDC00", FFFD],
		["high surrogate followed by non-surrogate", "\uD800X", [...FFFD, 0x58]],
		["two consecutive lone high surrogates", "\uD800\uD800", [...FFFD, ...FFFD]],
		["two consecutive lone low surrogates", "\uDC00\uDC00", [...FFFD, ...FFFD]],
		["low surrogate followed by high surrogate (wrong order)", "\uDC00\uD800", [...FFFD, ...FFFD]],
		["lone high surrogate after ascii", "a\uD800", [0x61, ...FFFD]],
		["lone low surrogate before ascii", "\uDC00b", [...FFFD, 0x62]],
	];

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test.each(testCases)("%s via TextEncoder", (_, input, expected) => {
		expect(Array.from(stringToUint8Array(input))).toEqual(expected);
		expect(Array.from(stringToUint8Array(input))).toEqual(Array.from(new TextEncoder().encode(input)));
	});

	test.each(testCases)("%s via the manual fallback", (_, input, expected) => {
		vi.stubGlobal("TextEncoder", undefined);
		expect(Array.from(stringToUint8Array(input))).toEqual(expected);
	});

	test("both code paths produce identical hashUnit results", () => {
		for (const [, input] of testCases) {
			const nativeHash = hashUnit(input);
			vi.stubGlobal("TextEncoder", undefined);
			const fallbackHash = hashUnit(input);
			vi.unstubAllGlobals();
			expect(fallbackHash).toBe(nativeHash);
		}
	});

	test("copies bytes from a TextEncoder view with an oversized backing buffer", () => {
		const OriginalTextEncoder = globalThis.TextEncoder;
		const expected = hashUnit("session_abc123");

		vi.stubGlobal(
			"TextEncoder",
			class {
				encode(value: string) {
					const bytes = new OriginalTextEncoder().encode(value);
					const view = new Uint8Array(new ArrayBuffer(bytes.byteLength + 16), 8, bytes.byteLength);
					view.set(bytes);
					return view;
				}
			}
		);

		const bytes = stringToUint8Array("session_abc123");
		expect(bytes.byteOffset).toBe(0);
		expect(bytes.byteLength).toBe(bytes.buffer.byteLength);
		expect(hashUnit("session_abc123")).toBe(expected);
	});
});
