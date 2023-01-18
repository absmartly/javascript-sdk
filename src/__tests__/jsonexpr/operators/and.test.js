import { AndCombinator } from "../../../jsonexpr/operators/and";
import { mockEvaluator } from "./evaluator";

describe("AndCombinator", () => {
	const combinator = new AndCombinator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true if all arguments evaluate to true", () => {
			expect(combinator.evaluate(evaluator, [true])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(true);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(true);
		});

		it("should return false if any argument evaluates to false", () => {
			expect(combinator.evaluate(evaluator, [false])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(false);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(false);
		});

		it("should return false if any argument evaluates to null", () => {
			expect(combinator.evaluate(evaluator, [null])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(null);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(null);
		});

		it("should short-circuit and not evaluate unnecessary expressions", () => {
			expect(combinator.evaluate(evaluator, [true, false, true])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, true);
			expect(evaluator.booleanConvert).toHaveBeenNthCalledWith(1, true);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, false);
			expect(evaluator.booleanConvert).toHaveBeenNthCalledWith(2, false);
		});

		it("should combine multiple arguments", () => {
			expect(combinator.evaluate(evaluator, [true, true])).toBe(true);
			expect(combinator.evaluate(evaluator, [true, true, true])).toBe(true);

			expect(combinator.evaluate(evaluator, [true, false])).toBe(false);
			expect(combinator.evaluate(evaluator, [false, true])).toBe(false);
			expect(combinator.evaluate(evaluator, [false, false])).toBe(false);
			expect(combinator.evaluate(evaluator, [false, false, false])).toBe(false);
		});
	});
});
