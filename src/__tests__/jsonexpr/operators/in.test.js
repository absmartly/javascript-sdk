import { mockEvaluator } from "./evaluator";
import { InOperator } from "../../../jsonexpr/operators/in";

describe("InOperator", () => {
	const operator = new InOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true if string contains needle", () => {
			expect(operator.evaluate(evaluator, ["abcdefghijk", "abc"])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "def"])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "xxx"])).toBe(false);

			expect(operator.evaluate(evaluator, ["abcdefghijk", null])).toBe(null);
			expect(operator.evaluate(evaluator, [null, "abc"])).toBe(null);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(9);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, "abcdefghijk");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, "abc");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(3, "abcdefghijk");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(4, "def");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(5, "abcdefghijk");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(6, "xxx");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(7, "abcdefghijk");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(8, null);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(9, null);

			expect(evaluator.stringConvert).toHaveBeenCalledTimes(3);
			expect(evaluator.stringConvert).toHaveBeenNthCalledWith(1, "abc");
			expect(evaluator.stringConvert).toHaveBeenNthCalledWith(2, "def");
			expect(evaluator.stringConvert).toHaveBeenNthCalledWith(3, "xxx");
		});

		it("should return false with empty array", () => {
			expect(operator.evaluate(evaluator, [[], 1])).toBe(false);
			expect(operator.evaluate(evaluator, [[], "1"])).toBe(false);
			expect(operator.evaluate(evaluator, [[], true])).toBe(false);
			expect(operator.evaluate(evaluator, [[], false])).toBe(false);
			expect(operator.evaluate(evaluator, [[], null])).toBe(null);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(10);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 1);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(3, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(4, "1");
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(5, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(6, true);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(7, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(8, false);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(9, []);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(10, null);

			expect(evaluator.booleanConvert).not.toHaveBeenCalled();
			expect(evaluator.numberConvert).not.toHaveBeenCalled();
			expect(evaluator.stringConvert).not.toHaveBeenCalled();
			expect(evaluator.compare).not.toHaveBeenCalled();
		});

		it("should compare array elements as left-side and needle as right-side", () => {
			const haystack01 = [0, 1];
			const haystack12 = [1, 2];

			expect(operator.evaluate(evaluator, [haystack01, 2])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystack01);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 2);
			expect(evaluator.compare).toHaveBeenCalledTimes(2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(1, 0, 2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(2, 1, 2);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [haystack12, 0])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystack12);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 0);
			expect(evaluator.compare).toHaveBeenCalledTimes(2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(1, 1, 0);
			expect(evaluator.compare).toHaveBeenNthCalledWith(2, 2, 0);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [haystack12, 1])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystack12);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 1);
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenNthCalledWith(1, 1, 1);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [haystack12, 2])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystack12);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 2);
			expect(evaluator.compare).toHaveBeenCalledTimes(2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(1, 1, 2);
			expect(evaluator.compare).toHaveBeenNthCalledWith(2, 2, 2);
		});

		it("should return true if object contains key", () => {
			const haystackab = { a: 1, b: 2 };
			const haystackbc = { b: 2, c: 3, 0: 100 };

			expect(operator.evaluate(evaluator, [haystackab, "c"])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystackab);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, "c");
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith("c");

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();

			expect(operator.evaluate(evaluator, [haystackbc, "a"])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystackbc);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, "a");
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith("a");

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();

			expect(operator.evaluate(evaluator, [haystackbc, "b"])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystackbc);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, "b");
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith("b");

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();

			expect(operator.evaluate(evaluator, [haystackbc, "c"])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystackbc);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, "c");
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith("c");

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();

			expect(operator.evaluate(evaluator, [haystackbc, 0])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, haystackbc);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 0);
			expect(evaluator.stringConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.stringConvert).toHaveBeenCalledWith(0);

			evaluator.evaluate.mockClear();
			evaluator.stringConvert.mockClear();
		});
	});
});

/*
		assertTrue((Boolean) operator.evaluate(evaluator, listOf(haystackbc, "b")));
		verify(evaluator, times(2)).evaluate(any());
		verify(evaluator, times(1)).evaluate(haystackbc);
		verify(evaluator, times(1)).stringConvert(any());
		verify(evaluator, times(1)).stringConvert("b");
		verify(evaluator, times(1)).evaluate("b");
		Mockito.clearInvocations(evaluator);

		assertTrue((Boolean) operator.evaluate(evaluator, listOf(haystackbc, "c")));
		verify(evaluator, times(2)).evaluate(any());
		verify(evaluator, times(1)).evaluate(haystackbc);
		verify(evaluator, times(1)).stringConvert(any());
		verify(evaluator, times(1)).stringConvert("c");
		verify(evaluator, times(1)).evaluate("c");
		Mockito.clearInvocations(evaluator);
 */
