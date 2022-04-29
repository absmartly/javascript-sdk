import { mockEvaluator } from "./evaluator";
import { VarOperator } from "../../../jsonexpr/operators/var";

describe("VarOperator", () => {
	const operator = new VarOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should call evaluator extract", () => {
			expect(operator.evaluate(evaluator, "a/b/c")).toBe("abc");

			expect(evaluator.extractVar).toHaveBeenCalledTimes(1);
			expect(evaluator.extractVar).toHaveBeenCalledWith("a/b/c");
			expect(evaluator.evaluate).not.toHaveBeenCalled();
		});
	});
});
