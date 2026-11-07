import { describe, expect, test } from "vitest";
import { insertUniqueSorted } from "../algorithm";

describe("insertUniqueSorted", () => {
	test("inserts into empty array", () => {
		const arr: number[] = [];
		insertUniqueSorted(arr, 5, (a, b) => a < b);
		expect(arr).toEqual([5]);
	});

	test("inserts in sorted order", () => {
		const arr = [1, 3, 5];
		insertUniqueSorted(arr, 2, (a, b) => a < b);
		expect(arr).toEqual([1, 2, 3, 5]);
	});

	test("inserts at beginning", () => {
		const arr = [2, 3, 4];
		insertUniqueSorted(arr, 1, (a, b) => a < b);
		expect(arr).toEqual([1, 2, 3, 4]);
	});

	test("inserts at end", () => {
		const arr = [1, 2, 3];
		insertUniqueSorted(arr, 4, (a, b) => a < b);
		expect(arr).toEqual([1, 2, 3, 4]);
	});

	test("does not insert duplicate", () => {
		const arr = [1, 2, 3];
		insertUniqueSorted(arr, 2, (a, b) => a < b);
		expect(arr).toEqual([1, 2, 3]);
	});
});
