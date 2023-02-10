import {
	arrayEqualsShallow,
	base64UrlNoPadding,
	chooseVariant,
	hashUnit,
	isEqualsDeep,
	isNumeric,
	isObject,
	isPromise,
	stringToUint8Array,
} from "../utils";

describe("isObject()", () => {
	it("should return true with objects", (done) => {
		expect(isObject({})).toBe(true);

		done();
	});

	it("should return false with common non-object", (done) => {
		expect(isObject(null)).toBe(false);
		expect(isObject([])).toBe(false);
		expect(isObject(1)).toBe(false);
		expect(isObject(true)).toBe(false);
		expect(isObject(false)).toBe(false);
		expect(isObject("str")).toBe(false);
		expect(isObject(new Uint8Array(1))).toBe(false);

		done();
	});
});

describe("isNumeric()", () => {
	it("should return true with numbers", (done) => {
		expect(isNumeric(1)).toBe(true);
		expect(isNumeric(1.5)).toBe(true);

		done();
	});

	it("should return false with non-numbers", (done) => {
		expect(isNumeric(null)).toBe(false);
		expect(isNumeric("1")).toBe(false);
		expect(isNumeric(true)).toBe(false);
		expect(isNumeric(false)).toBe(false);
		expect(isNumeric([])).toBe(false);
		expect(isNumeric({})).toBe(false);

		done();
	});
});

describe("isPromise()", () => {
	it("should return true with a thenable object", (done) => {
		expect(
			isPromise({
				then() {},
			})
		).toBe(true);

		done();
	});

	it("should return false with non objects or objects without then function", (done) => {
		expect(isPromise(null)).toBe(false);
		expect(isPromise([])).toBe(false);
		expect(isPromise({})).toBe(false);
		expect(isPromise(1)).toBe(false);
		expect(isPromise(true)).toBe(false);
		expect(isPromise(false)).toBe(false);
		expect(isPromise("str")).toBe(false);
		expect(isPromise(new Uint8Array(1))).toBe(false);

		done();
	});
});

describe("isEqualsDeep()", () => {
	it("should return true with two NaNs", (done) => {
		expect(isEqualsDeep(Number.NaN, Number.NaN)).toBe(true);

		done();
	});

	it("should return true iff basic primitives are equal", (done) => {
		expect(isEqualsDeep(0, 0)).toBe(true);
		expect(isEqualsDeep(1, 1)).toBe(true);
		expect(isEqualsDeep(1.5, 1.5)).toBe(true);
		expect(isEqualsDeep("", "")).toBe(true);
		expect(isEqualsDeep("abc", "abc")).toBe(true);
		expect(isEqualsDeep(true, true)).toBe(true);
		expect(isEqualsDeep(false, false)).toBe(true);

		expect(isEqualsDeep(0, 1)).toBe(false);
		expect(isEqualsDeep(1, 1.5)).toBe(false);
		expect(isEqualsDeep(1.5, "")).toBe(false);
		expect(isEqualsDeep("", "abc")).toBe(false);
		expect(isEqualsDeep("abc", true)).toBe(false);
		expect(isEqualsDeep(true, false)).toBe(false);
		expect(isEqualsDeep(false, 0)).toBe(false);

		done();
	});

	it("should return true iff arrays are equal", (done) => {
		expect(isEqualsDeep([1, 2, 3], [1, 2, 3])).toBe(true);
		expect(isEqualsDeep([1, 2, 3], [3, 2, 1])).toBe(false);

		expect(isEqualsDeep([], [1])).toBe(false);
		expect(isEqualsDeep([1], [])).toBe(false);

		expect(isEqualsDeep([1, 2, [3, 4, [5, 6]]], [1, 2, [3, 4, [5, 6]]])).toBe(true);
		expect(isEqualsDeep([1, 2, [3, 4, [5, 6]]], [1, 2, [3, 4, [5, 9]]])).toBe(false);

		expect(isEqualsDeep(["a", "b", ["c", "d", ["e", "f"]]], ["a", "b", ["c", "d", ["e", "f"]]])).toBe(true);
		expect(isEqualsDeep(["a", "b", ["c", "d", ["e", "f"]]], ["a", "b", ["c", "d", ["e", "x"]]])).toBe(false);

		done();
	});

	it("should return true iff arrays with circular references are equal", (done) => {
		const a = [1, 2, [3, 4, [5, 6]]];
		a[1] = a;

		const b = [1, 2, [3, 4, [5, 6]]];
		b[1] = b;

		expect(isEqualsDeep(a, b)).toBe(true);

		a[2][2][0] = a;
		b[2][2][0] = b;

		expect(isEqualsDeep(a, b)).toBe(true);

		b[2][2][1] = 9;

		expect(isEqualsDeep(a, b)).toBe(false);

		done();
	});

	it("should return true iff objects are equal", (done) => {
		expect(isEqualsDeep({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 })).toBe(true);
		expect(isEqualsDeep({ a: 1, b: 2, c: 3 }, { c: 3, b: 2, a: 1 })).toBe(true);
		expect(isEqualsDeep({ a: 1, b: 2, c: 3 }, { a: 3, b: 2, c: 1 })).toBe(false);

		expect(isEqualsDeep({}, { a: 1 })).toBe(false);
		expect(isEqualsDeep({ a: 1 }, {})).toBe(false);

		expect(
			isEqualsDeep(
				{ a: 1, b: 2, c: { d: 3, e: 4, f: { g: 5, h: 6 } } },
				{ a: 1, b: 2, c: { d: 3, e: 4, f: { g: 5, h: 6 } } }
			)
		).toBe(true);
		expect(
			isEqualsDeep(
				{ a: 1, b: 2, c: { d: 3, e: 4, f: { g: 5, h: 6 } } },
				{ a: 1, b: 2, c: { d: 3, e: 4, f: { g: 5, h: 9 } } }
			)
		).toBe(false);

		expect(
			isEqualsDeep(
				{ a: "a", b: "b", c: { d: "c", e: "d", f: { g: "e", h: "f" } } },
				{ a: "a", b: "b", c: { d: "c", e: "d", f: { g: "e", h: "f" } } }
			)
		).toBe(true);
		expect(
			isEqualsDeep(
				{ a: "a", b: "b", c: { d: "c", e: "d", f: { g: "e", h: "f" } } },
				{ a: "a", b: "b", c: { d: "c", e: "d", f: { g: "e", h: "x" } } }
			)
		).toBe(false);

		done();
	});

	it("should return true iff arrays with circular references are equal", (done) => {
		const a = { a: 1, b: 2, c: { d: 3, e: 4, f: { g: 5, h: 6 } } };
		a.b = a;

		const b = { a: 1, b: 2, c: { d: 3, e: 4, f: { g: 5, h: 6 } } };
		b.b = b;

		expect(isEqualsDeep(a, b)).toBe(true);

		a.c.f.g = a;
		b.c.f.g = b;

		expect(isEqualsDeep(a, b)).toBe(true);

		b.c.f.h = 9;

		expect(isEqualsDeep(a, b)).toBe(false);

		done();
	});
});

describe("arrayEqualsShallow()", () => {
	it("should return true only with equal arrays", (done) => {
		expect(arrayEqualsShallow([], [])).toEqual(true);
		expect(arrayEqualsShallow([1], [1])).toEqual(true);
		expect(arrayEqualsShallow([1, 2, 3], [1, 2, 3])).toEqual(true);
		expect(arrayEqualsShallow([0.5, 1.0, 1.5], [0.5, 1.0, 1.5])).toEqual(true);

		expect(arrayEqualsShallow([1], ["1"])).toEqual(false);
		expect(arrayEqualsShallow([1, 2, 3], [1, 2, "3"])).toEqual(false);
		expect(arrayEqualsShallow([1], [])).toEqual(false);
		expect(arrayEqualsShallow([], [1])).toEqual(false);
		expect(arrayEqualsShallow([1, 2, 3], [1, 2])).toEqual(false);
		expect(arrayEqualsShallow([1, 2], [1, 2, 3])).toEqual(false);

		done();
	});
});

describe("hashUnit()", () => {
	it("should return matching hashes", (done) => {
		expect(hashUnit("4a42766ca6313d26f49985e799ff4f3790fb86efa0fce46edb3ea8fbf1ea3408")).toBe(
			"H2jvj6o9YcAgNdhKqEbtWw"
		);
		expect(hashUnit("bleh@absmarty.com")).toBe("DRgslOje35bZMmpaohQjkA");
		expect(hashUnit("açb↓c")).toBe("LxcqH5VC15rXfWfA_smreg");
		expect(hashUnit("testy")).toBe("K5I_V6RgP8c6sYKz-TVn8g");
		expect(hashUnit(123456778999)).toBe("K4uy4bTeCy34W97lmceVRg");

		done();
	});
});

describe("chooseVariant()", () => {
	it("should return correct variant", (done) => {
		expect(chooseVariant([0.0, 1.0], 0.0)).toBe(1);
		expect(chooseVariant([0.0, 1.0], 0.5)).toBe(1);
		expect(chooseVariant([0.0, 1.0], 1.0)).toBe(1);

		expect(chooseVariant([1.0, 0.0], 0.0)).toBe(0);
		expect(chooseVariant([1.0, 0.0], 0.5)).toBe(0);
		expect(chooseVariant([1.0, 0.0], 1.0)).toBe(1);

		expect(chooseVariant([0.5, 0.5], 0.0)).toBe(0);
		expect(chooseVariant([0.5, 0.5], 0.25)).toBe(0);
		expect(chooseVariant([0.5, 0.5], 0.49999999)).toBe(0);
		expect(chooseVariant([0.5, 0.5], 0.5)).toBe(1);
		expect(chooseVariant([0.5, 0.5], 0.50000001)).toBe(1);
		expect(chooseVariant([0.5, 0.5], 0.75)).toBe(1);
		expect(chooseVariant([0.5, 0.5], 1.0)).toBe(1);

		expect(chooseVariant([0.333, 0.333, 0.334], 0.0)).toBe(0);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.25)).toBe(0);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.33299999)).toBe(0);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.333)).toBe(1);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.33300001)).toBe(1);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.5)).toBe(1);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.66599999)).toBe(1);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.666)).toBe(2);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.66600001)).toBe(2);
		expect(chooseVariant([0.333, 0.333, 0.334], 0.75)).toBe(2);
		expect(chooseVariant([0.333, 0.333, 0.334], 1.0)).toBe(2);

		done();
	});
});

describe("stringToUint8Array()", () => {
	it("should encode special characters to utf8", (done) => {
		const testCases = [
			["", Uint8Array.from([])],
			[" ", Uint8Array.from([32])],
			["a", Uint8Array.from([97])],
			["ab", Uint8Array.from([97, 98])],
			["abc", Uint8Array.from([97, 98, 99])],
			["abcd", Uint8Array.from([97, 98, 99, 100])],
			["ç", Uint8Array.from([195, 167])],
			["aç", Uint8Array.from([97, 195, 167])],
			["çb", Uint8Array.from([195, 167, 98])],
			["açb", Uint8Array.from([97, 195, 167, 98])],
			["↓", Uint8Array.from([226, 134, 147])],
			["a↓", Uint8Array.from([97, 226, 134, 147])],
			["↓b", Uint8Array.from([226, 134, 147, 98])],
			["a↓b", Uint8Array.from([97, 226, 134, 147, 98])],
			["aç↓", Uint8Array.from([97, 195, 167, 226, 134, 147])],
			["aç↓b", Uint8Array.from([97, 195, 167, 226, 134, 147, 98])],
			["açb↓c", Uint8Array.from([97, 195, 167, 98, 226, 134, 147, 99])],
		];

		for (const testCase of testCases) {
			const array = stringToUint8Array(testCase[0]);
			const expected = testCase[1];
			expect(array.length).toBe(expected.length);
			for (let i = 0; i < array.length; ++i) {
				expect(array[i]).toBe(expected[i]);
			}
		}
		done();
	});
});

describe("base64UrlNoPadding()", () => {
	it("should match known encodings", (done) => {
		const testCases = [
			["", ""],
			[" ", "IA"],
			["t", "dA"],
			["te", "dGU"],
			["tes", "dGVz"],
			["test", "dGVzdA"],
			["testy", "dGVzdHk"],
			["testy1", "dGVzdHkx"],
			["testy12", "dGVzdHkxMg"],
			["testy123", "dGVzdHkxMjM"],
			["special characters açb↓c", "c3BlY2lhbCBjaGFyYWN0ZXJzIGHDp2LihpNj"],
			[
				"The quick brown fox jumps over the lazy dog",
				"VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZw",
			],
			[
				"The quick brown fox jumps over the lazy dog and eats a pie",
				"VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZyBhbmQgZWF0cyBhIHBpZQ",
			],
			[
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
				"TG9yZW0gaXBzdW0gZG9sb3Igc2l0IGFtZXQsIGNvbnNlY3RldHVyIGFkaXBpc2NpbmcgZWxpdCwgc2VkIGRvIGVpdXNtb2QgdGVtcG9yIGluY2lkaWR1bnQgdXQgbGFib3JlIGV0IGRvbG9yZSBtYWduYSBhbGlxdWEuIFV0IGVuaW0gYWQgbWluaW0gdmVuaWFtLCBxdWlzIG5vc3RydWQgZXhlcmNpdGF0aW9uIHVsbGFtY28gbGFib3JpcyBuaXNpIHV0IGFsaXF1aXAgZXggZWEgY29tbW9kbyBjb25zZXF1YXQuIER1aXMgYXV0ZSBpcnVyZSBkb2xvciBpbiByZXByZWhlbmRlcml0IGluIHZvbHVwdGF0ZSB2ZWxpdCBlc3NlIGNpbGx1bSBkb2xvcmUgZXUgZnVnaWF0IG51bGxhIHBhcmlhdHVyLiBFeGNlcHRldXIgc2ludCBvY2NhZWNhdCBjdXBpZGF0YXQgbm9uIHByb2lkZW50LCBzdW50IGluIGN1bHBhIHF1aSBvZmZpY2lhIGRlc2VydW50IG1vbGxpdCBhbmltIGlkIGVzdCBsYWJvcnVtLg",
			],
		];

		testCases.forEach((testCase) => {
			const bytes = stringToUint8Array(testCase[0]);
			expect(base64UrlNoPadding(bytes)).toEqual(testCase[1]);
		});

		done();
	});
});
