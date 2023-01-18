import { mockEvaluator } from "./evaluator";
import { NullOperator } from "../../../jsonexpr/operators/null";

describe("NullOperator", () => {
	const operator = new NullOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true if argument is null", () => {
			expect(operator.evaluate(evaluator, null)).toBe(true);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(null);
			expect(evaluator.booleanConvert).not.toHaveBeenCalled();
		});

		it("should return true if argument is not null", () => {
			expect(operator.evaluate(evaluator, true)).toBe(false);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(true);

			expect(operator.evaluate(evaluator, false)).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, false);

			expect(operator.evaluate(evaluator, 0)).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(3);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(3, 0);
		});
	});
});

/*
	@Test
	void testNull() {
		assertTrue((Boolean) operator.evaluate(evaluator, null));
		verify(evaluator, times(1)).evaluate(null);
	}

	@Test
	void testNotNull() {
		assertFalse((Boolean) operator.evaluate(evaluator, true));
		verify(evaluator, times(1)).evaluate(true);

		assertFalse((Boolean) operator.evaluate(evaluator, false));
		verify(evaluator, times(1)).evaluate(false);

		assertFalse((Boolean) operator.evaluate(evaluator, 0));
		verify(evaluator, times(1)).evaluate(0);
	}
 */
