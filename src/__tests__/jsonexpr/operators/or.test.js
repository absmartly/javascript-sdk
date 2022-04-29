import { mockEvaluator } from "./evaluator";
import { OrCombinator } from "../../../jsonexpr/operators/or";

describe("OrCombinator", () => {
	const combinator = new OrCombinator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true if any argument evaluates to true", () => {
			expect(combinator.evaluate(evaluator, [true])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(true);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(true);
		});

		it("should return false if all arguments evaluate to false", () => {
			expect(combinator.evaluate(evaluator, [false])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(false);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(false);
		});

		it("should return false if all arguments evaluates to null", () => {
			expect(combinator.evaluate(evaluator, [null])).toBe(false);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenCalledWith(null);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledWith(null);
		});

		it("should short-circuit and not evaluate unnecessary expressions", () => {
			expect(combinator.evaluate(evaluator, [true, false, true])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.booleanConvert).toHaveBeenCalledTimes(1);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, true);
			expect(evaluator.booleanConvert).toHaveBeenNthCalledWith(1, true);
		});

		it("should combine multiple arguments", () => {
			expect(combinator.evaluate(evaluator, [true, true])).toBe(true);
			expect(combinator.evaluate(evaluator, [true, true, true])).toBe(true);

			expect(combinator.evaluate(evaluator, [true, false])).toBe(true);
			expect(combinator.evaluate(evaluator, [false, true])).toBe(true);
			expect(combinator.evaluate(evaluator, [false, false])).toBe(false);
			expect(combinator.evaluate(evaluator, [false, false, false])).toBe(false);
		});
	});
});
