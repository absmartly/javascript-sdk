import { isNumeric, isObject } from "../utils";

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
