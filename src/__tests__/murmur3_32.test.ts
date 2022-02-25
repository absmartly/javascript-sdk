import { stringToUint8Array } from "../utils";
import { murmur3_32 } from "../murmur3_32";

describe("murmur3_32()", () => {
	const testCases = [
		["", 0x00000000, 0x00000000],
		[" ", 0x00000000, 0x7ef49b98],
		["t", 0x00000000, 0xca87df4d],
		["te", 0x00000000, 0xedb8ee1b],
		["tes", 0x00000000, 0x0bb90e5a],
		["test", 0x00000000, 0xba6bd213],
		["testy", 0x00000000, 0x44af8342],
		["testy1", 0x00000000, 0x8a1a243a],
		["testy12", 0x00000000, 0x845461b9],
		["testy123", 0x00000000, 0x47628ac4],
		["special characters açb↓c", 0x00000000, 0xbe83b140],
		["The quick brown fox jumps over the lazy dog", 0x00000000, 0x2e4ff723],
		["", 0xdeadbeef, 0x0de5c6a9],
		[" ", 0xdeadbeef, 0x25acce43],
		["t", 0xdeadbeef, 0x3b15dcf8],
		["te", 0xdeadbeef, 0xac981332],
		["tes", 0xdeadbeef, 0xc1c78dda],
		["test", 0xdeadbeef, 0xaa22d41a],
		["testy", 0xdeadbeef, 0x84f5f623],
		["testy1", 0xdeadbeef, 0x09ed28e9],
		["testy12", 0xdeadbeef, 0x22467835],
		["testy123", 0xdeadbeef, 0xd633060d],
		["special characters açb↓c", 0xdeadbeef, 0xf7fdd8a2],
		["The quick brown fox jumps over the lazy dog", 0xdeadbeef, 0x3a7b3f4d],
		["", 0x00000001, 0x514e28b7],
		[" ", 0x00000001, 0x4f0f7132],
		["t", 0x00000001, 0x5db1831e],
		["te", 0x00000001, 0xd248bb2e],
		["tes", 0x00000001, 0xd432eb74],
		["test", 0x00000001, 0x99c02ae2],
		["testy", 0x00000001, 0xc5b2dc1e],
		["testy1", 0x00000001, 0x33925ceb],
		["testy12", 0x00000001, 0xd92c9f23],
		["testy123", 0x00000001, 0x3bc1712d],
		["special characters açb↓c", 0x00000001, 0x293327b5],
		["The quick brown fox jumps over the lazy dog", 0x00000001, 0x78e69e27],
	];

	it("should match known hashes", (done) => {
		testCases.forEach((testCase) => {
			const bytes = stringToUint8Array(testCase[0]);
			expect(murmur3_32(bytes.buffer, testCase[1] as number)).toBe(testCase[2]);
		});

		done();
	});
});
