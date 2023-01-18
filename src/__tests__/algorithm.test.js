import { insertUniqueSorted } from "../algorithm";

describe("insertUniqueSorted", () => {
	it("should insert a number into the center of an array", (done) => {
		const arr = [0, 1, 3, 5, 8];

		insertUniqueSorted(arr, 2, (a, b) => a < b);

		expect(arr).toEqual([0, 1, 2, 3, 5, 8]);

		done();
	});

	it("should not insert a duplicate value", (done) => {
		const arr = [0, 1, 2, 3];

		insertUniqueSorted(arr, 2, (a, b) => a < b);

		expect(arr).toEqual([0, 1, 2, 3]);

		done();
	});

	it("should insert the highest value at the end of an array", (done) => {
		const arr = [0, 1, 2, 3];

		insertUniqueSorted(arr, 100, (a, b) => a < b);

		expect(arr).toEqual([0, 1, 2, 3, 100]);

		done();
	});

	it("should insert the lowest value at the beginning of an array", (done) => {
		const arr = [1, 2, 3];

		insertUniqueSorted(arr, 0, (a, b) => a < b);

		expect(arr).toEqual([0, 1, 2, 3]);

		done();
	});
});
