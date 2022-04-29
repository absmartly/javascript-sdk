import { mockEvaluator } from "./evaluator";
import { ValueOperator } from "../../../jsonexpr/operators/value";

describe("ValueOperator", () => {
	const operator = new ValueOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should not call evaluator evaluate", () => {
			expect(operator.evaluate(evaluator, 0)).toBe(0);
			expect(operator.evaluate(evaluator, 1)).toBe(1);
			expect(operator.evaluate(evaluator, true)).toBe(true);
			expect(operator.evaluate(evaluator, false)).toBe(false);
			expect(operator.evaluate(evaluator, "")).toBe("");
			expect(operator.evaluate(evaluator, null)).toBe(null);
			expect(operator.evaluate(evaluator, {})).toEqual({});
			expect(operator.evaluate(evaluator, [])).toEqual([]);

			expect(evaluator.evaluate).not.toHaveBeenCalled();
		});
	});
});
