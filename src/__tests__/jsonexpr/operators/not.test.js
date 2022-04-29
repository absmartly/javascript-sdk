import { mockEvaluator } from "./evaluator";
import { NotOperator } from "../../../jsonexpr/operators/not";

describe("NotOperator", () => {
	const operator = new NotOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true if argument is falsy", () => {
			expect(operator.evaluate(evaluator, false)).toBe(true);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(false);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(false);
		});

		it("should return false if argument is truthy", () => {
			expect(operator.evaluate(evaluator, true)).toBe(false);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(true);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(true);
		});

		it("should return true if argument is null", () => {
			expect(operator.evaluate(evaluator, null)).toBe(true);

			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(null);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(null);
		});
	});
});
