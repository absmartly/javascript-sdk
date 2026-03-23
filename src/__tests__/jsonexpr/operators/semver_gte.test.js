import { mockEvaluator } from "./evaluator";
import { SemverGreaterThanOrEqualOperator } from "../../../jsonexpr/operators/semver_gte";

describe("SemverGreaterThanOrEqualOperator", () => {
	const operator = new SemverGreaterThanOrEqualOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("should return true when left version is greater", () => {
			expect(operator.evaluate(evaluator, ["2.0.0", "1.0.0"])).toBe(true);
			expect(evaluator.versionCompare).toHaveBeenCalledWith("2.0.0", "1.0.0");

			evaluator.evaluate.mockClear();
			evaluator.versionCompare.mockClear();
		});

		it("should return true when versions are equal", () => {
			expect(operator.evaluate(evaluator, ["1.0.0", "1.0.0"])).toBe(true);
			expect(evaluator.versionCompare).toHaveBeenCalledWith("1.0.0", "1.0.0");

			evaluator.evaluate.mockClear();
			evaluator.versionCompare.mockClear();
		});

		it("should return false when left version is less", () => {
			expect(operator.evaluate(evaluator, ["1.0.0", "2.0.0"])).toBe(false);
			expect(evaluator.versionCompare).toHaveBeenCalledWith("1.0.0", "2.0.0");

			evaluator.evaluate.mockClear();
			evaluator.versionCompare.mockClear();
		});

		it("should return null for null inputs", () => {
			expect(operator.evaluate(evaluator, [null, null])).toBe(null);

			evaluator.evaluate.mockClear();
			evaluator.versionCompare.mockClear();
		});
	});
});
