import { describe, expect, test } from "vitest";
import { arrayEqualsShallow, chooseVariant, isEqualsDeep, isObject, isPromise } from "../utils";

describe("isObject", () => {
	test("returns true for plain objects", () => {
		expect(isObject({})).toBe(true);
		expect(isObject({ a: 1 })).toBe(true);
	});

	test("returns false for non-objects", () => {
		expect(isObject(null)).toBe(false);
		expect(isObject(undefined)).toBe(false);
		expect(isObject(42)).toBe(false);
		expect(isObject("str")).toBe(false);
		expect(isObject([])).toBe(false);
		expect(isObject(new Date())).toBe(false);
	});
});

describe("isPromise", () => {
	test("returns true for promises", () => {
		expect(isPromise(Promise.resolve())).toBe(true);
		expect(isPromise({ then: () => {} })).toBe(true);
	});

	test("returns false for non-promises", () => {
		expect(isPromise(null)).toBe(false);
		expect(isPromise(undefined)).toBe(false);
		expect(isPromise({})).toBe(false);
		expect(isPromise(42)).toBe(false);
	});
});

describe("isEqualsDeep", () => {
	test("primitives", () => {
		expect(isEqualsDeep(1, 1)).toBe(true);
		expect(isEqualsDeep(1, 2)).toBe(false);
		expect(isEqualsDeep("a", "a")).toBe(true);
		expect(isEqualsDeep("a", "b")).toBe(false);
		expect(isEqualsDeep(true, true)).toBe(true);
		expect(isEqualsDeep(true, false)).toBe(false);
	});

	test("NaN", () => {
		expect(isEqualsDeep(NaN, NaN)).toBe(true);
	});

	test("arrays", () => {
		expect(isEqualsDeep([1, 2, 3], [1, 2, 3])).toBe(true);
		expect(isEqualsDeep([1, 2, 3], [1, 2, 4])).toBe(false);
		expect(isEqualsDeep([1, 2], [1, 2, 3])).toBe(false);
	});

	test("objects", () => {
		expect(isEqualsDeep({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
		expect(isEqualsDeep({ a: 1 }, { a: 2 })).toBe(false);
		expect(isEqualsDeep({ a: 1 }, { a: 1, b: 2 })).toBe(false);
	});

	test("nested structures", () => {
		expect(isEqualsDeep({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
		expect(isEqualsDeep({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
	});

	test("different types", () => {
		expect(isEqualsDeep(1, "1")).toBe(false);
		expect(isEqualsDeep([], {})).toBe(false);
	});
});

describe("arrayEqualsShallow", () => {
	test("same reference", () => {
		const arr = [1, 2, 3];
		expect(arrayEqualsShallow(arr, arr)).toBe(true);
	});

	test("equal arrays", () => {
		expect(arrayEqualsShallow([1, 2, 3], [1, 2, 3])).toBe(true);
	});

	test("different arrays", () => {
		expect(arrayEqualsShallow([1, 2, 3], [1, 2, 4])).toBe(false);
	});

	test("different lengths", () => {
		expect(arrayEqualsShallow([1, 2], [1, 2, 3])).toBe(false);
	});

	test("both undefined", () => {
		expect(arrayEqualsShallow(undefined, undefined)).toBe(true);
	});
});

describe("chooseVariant", () => {
	test("selects correct variant based on probability", () => {
		expect(chooseVariant([0.5, 0.5], 0.0)).toBe(0);
		expect(chooseVariant([0.5, 0.5], 0.4)).toBe(0);
		expect(chooseVariant([0.5, 0.5], 0.5)).toBe(1);
		expect(chooseVariant([0.5, 0.5], 0.9)).toBe(1);
	});

	test("three-way split", () => {
		expect(chooseVariant([0.33, 0.33, 0.34], 0.0)).toBe(0);
		expect(chooseVariant([0.33, 0.33, 0.34], 0.3)).toBe(0);
		expect(chooseVariant([0.33, 0.33, 0.34], 0.33)).toBe(1);
		expect(chooseVariant([0.33, 0.33, 0.34], 0.65)).toBe(1);
		expect(chooseVariant([0.33, 0.33, 0.34], 0.66)).toBe(2);
	});

	test("returns last variant for probability >= 1", () => {
		expect(chooseVariant([0.5, 0.5], 1.0)).toBe(1);
	});
});
