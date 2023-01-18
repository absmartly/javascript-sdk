import { mockEvaluator } from "./evaluator";
import { GreaterThanOperator } from "../../../jsonexpr/operators/gt";

describe("GreaterThanOperator", () => {
	const operator = new GreaterThanOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true when left-side argument is greater and comparable", () => {
			expect(operator.evaluate(evaluator, [0, 0])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 0);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 0);
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenCalledWith(0, 0);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [1, 0])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 1);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 0);
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenCalledWith(1, 0);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [0, 1])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 0);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 1);
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenCalledWith(0, 1);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [null, null])).toBe(null);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, null);
			expect(evaluator.compare).toHaveBeenCalledTimes(0);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();
		});
	});
});
