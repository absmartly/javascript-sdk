import { mockEvaluator } from "./evaluator";
import { EqualsOperator } from "../../../jsonexpr/operators/eq";

describe("EqOperator", () => {
	const operator = new EqualsOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true when arguments are equal and comparable", () => {
			expect(operator.evaluate(evaluator, [0, 0])).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, 0);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, 0);
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenCalledWith(0, 0);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(operator.evaluate(evaluator, [1, 0])).toBe(false);
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

			expect(
				operator.evaluate(evaluator, [
					[1, 2],
					[1, 2],
				])
			).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, [1, 2]);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, [1, 2]);
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenCalledWith([1, 2], [1, 2]);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(
				operator.evaluate(evaluator, [
					[1, 2],
					[3, 4],
				])
			).toBe(null);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, [1, 2]);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, [3, 4]);
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenCalledWith([1, 2], [3, 4]);

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(
				operator.evaluate(evaluator, [
					{ a: 1, b: 2 },
					{ a: 1, b: 2 },
				])
			).toBe(true);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, { a: 1, b: 2 });
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, { a: 1, b: 2 });
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenCalledWith({ a: 1, b: 2 }, { a: 1, b: 2 });

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();

			expect(
				operator.evaluate(evaluator, [
					{ a: 1, b: 2 },
					{ a: 3, b: 4 },
				])
			).toBe(null);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(1, { a: 1, b: 2 });
			expect(evaluator.evaluate).toHaveBeenNthCalledWith(2, { a: 3, b: 4 });
			expect(evaluator.compare).toHaveBeenCalledTimes(1);
			expect(evaluator.compare).toHaveBeenCalledWith({ a: 1, b: 2 }, { a: 3, b: 4 });

			evaluator.evaluate.mockClear();
			evaluator.compare.mockClear();
		});
	});
});
