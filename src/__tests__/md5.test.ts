import { describe, expect, test } from "vitest";
import { md5 } from "../md5";

function stringToBuffer(value: string): ArrayBuffer {
	const n = value.length;
	const array: number[] = [];
	let k = 0;
	for (let i = 0; i < n; ++i) {
		const c = value.charCodeAt(i);
		if (c < 0x80) {
			array[k++] = c;
		} else if (c < 0x800) {
			array[k++] = (c >> 6) | 192;
			array[k++] = (c & 63) | 128;
		} else {
			array[k++] = (c >> 12) | 224;
			array[k++] = ((c >> 6) & 63) | 128;
			array[k++] = (c & 63) | 128;
		}
	}
	return Uint8Array.from(array).buffer;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

describe("md5", () => {
	const testCases: [string, string][] = [
		["", "d41d8cd98f00b204e9800998ecf8427e"],
		["a", "0cc175b9c0f1b6a831c399e269772661"],
		["abc", "900150983cd24fb0d6963f7d28e17f72"],
		["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
		["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
	];

	for (const [input, expectedHex] of testCases) {
		test(`md5("${input}") == ${expectedHex}`, () => {
			const result = md5(stringToBuffer(input));
			expect(toHex(result)).toBe(expectedHex);
		});
	}
});
