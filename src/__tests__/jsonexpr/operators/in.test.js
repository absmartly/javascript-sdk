import { mockEvaluator } from "./evaluator";
import { InOperator } from "../../../jsonexpr/operators/in";

describe("InOperator", () => {
	const operator = new InOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true if string contains needle", () => {
			expect(operator.evaluate(evaluator, ["abc", "abcdefghijk"])).toBe(true);
			expect(operator.evaluate(evaluator, ["def", "abcdefghijk"])).toBe(true);
			expect(operator.evaluate(evaluator, ["xxx", "abcdefghijk"])).toBe(false);

			expect(operator.evaluate(evaluator, [null, "abcdefghijk"])).toBe(null);
			expect(operator.evaluate(evaluator, ["abc", null])).toBe(null);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(9);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, "abc");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, "abcdefghijk");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(3, "def");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(4, "abcdefghijk");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(5, "xxx");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(6, "abcdefghijk");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(7, null);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(9, null);

			expect(evaluator.stringConvert).toHaveBeenCalledTimes(3);
			expect(evaluator.stringConvert).toHaveBeenNthCalledWith(1, "abc");
			expect(evaluator.stringConvert).toHaveBeenNthCalledWith(2, "def");
			expect(evaluator.stringConvert).toHaveBeenNthCalledWith(3, "xxx");
		});

		it("should return false with empty array", () => {
			expect(operator.evaluate(evaluator, [1, []])).toBe(false);
			expect(operator.evaluate(evaluator, ["1", []])).toBe(false);
			expect(operator.evaluate(evaluator, [true, []])).toBe(false);
			expect(operator.evaluate(evaluator, [false, []])).toBe(false);
			expect(operator.evaluate(evaluator, [null, []])).toBe(null);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(9);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 1);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(3, "1");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(4, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(5, true);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(6, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(7, false);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(8, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(9, null);

			expect(evaluator.booleanConvert).not.toHaveBeenCalled();
			expect(evaluator.numberConvert).not.toHaveBeenCalled();
			expect(evaluator.stringConvert).not.toHaveBeenCalled();
			expect(evaluator.compare).not.toHaveBeenCalled();
		});

		it("should compare array elements as left-side and needle as right-side", () => {
			const haystack01 = [0, 1];
			const haystack12 = [1, 2];

			expect(operator.evaluate(evaluator, [2, haystack01])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystack01);
			expect(evaluator.compare).toHaveBeenCalledTimes(2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(1, 0, 2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(2, 1, 2);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [0, haystack12])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 0);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystack12);
			expect(evaluator.compare).toHaveBeenCalledTimes(2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(1, 1, 0);
			expect(evaluator.compare).toHaveBeenNthCalledWith(2, 2, 0);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [1, haystack12])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 1);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystack12);
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenNthCalledWith(1, 1, 1);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [2, haystack12])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystack12);
			expect(evaluator.compare).toHaveBeenCalledTimes(2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(1, 1, 2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(2, 2, 2);
		});

		it("should return true if object contains key", () => {
			const haystackab = { a: 1, b: 2 };
			const haystackbc = { b: 2, c: 3, 0: 100 };

			expect(operator.evaluate(evaluator, ["c", haystackab])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, "c");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystackab);
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith("c");

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();

			expect(operator.evaluate(evaluator, ["a", haystackbc])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, "a");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystackbc);
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith("a");

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();

			expect(operator.evaluate(evaluator, ["b", haystackbc])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, "b");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystackbc);
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith("b");

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();

			expect(operator.evaluate(evaluator, ["c", haystackbc])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, "c");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystackbc);
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith("c");

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();

			expect(operator.evaluate(evaluator, [0, haystackbc])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 0);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, haystackbc);
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith(0);

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();
		});
	});
});
