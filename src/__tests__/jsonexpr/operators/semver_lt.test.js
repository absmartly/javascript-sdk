import { mockEvaluator } from "./evaluator";
import { SemverLessThanOperator } from "../../../jsonexpr/operators/semver_lt";

describe("SemverLessThanOperator", () => {
	const operator = new SemverLessThanOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		afterEach(() => {
			evaluator.evaluate.mockClear();
			evaluator.versionCompare.mockClear();
		});

		it("should return true when left version is less", () => {
			expect(operator.evaluate(evaluator, ["1.0.0", "2.0.0"])).toBe(true);
			expect(evaluator.versionCompare).toHaveBeenCalledWith("1.0.0", "2.0.0");
		});

		it("should return false when versions are equal", () => {
			expect(operator.evaluate(evaluator, ["1.0.0", "1.0.0"])).toBe(false);
			expect(evaluator.versionCompare).toHaveBeenCalledWith("1.0.0", "1.0.0");
		});

		it("should return false when left version is greater", () => {
			expect(operator.evaluate(evaluator, ["2.0.0", "1.0.0"])).toBe(false);
			expect(evaluator.versionCompare).toHaveBeenCalledWith("2.0.0", "1.0.0");
		});

		it("should return null when lhs is null", () => {
			expect(operator.evaluate(evaluator, [null, "1.0.0"])).toBe(null);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
			expect(evaluator.versionCompare).not.toHaveBeenCalled();
		});

		it("should return null when rhs is null", () => {
			expect(operator.evaluate(evaluator, ["1.0.0", null])).toBe(null);
			expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
			expect(evaluator.versionCompare).not.toHaveBeenCalled();
		});
	});
});
