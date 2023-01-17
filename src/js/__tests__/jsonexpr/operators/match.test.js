import { mockEvaluator } from "./evaluator";
import { MatchOperator } from "../../../jsonexpr/operators/match";

describe("MatchOperator", () => {
	const operator = new MatchOperator();

	describe("evaluate", () => {
		const evaluator = mockEvaluator();

		it("", () => {
			expect(operator.evaluate(evaluator, ["abcdefghijk", ""])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "abc"])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "ijk"])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "^abc"])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "ijk$"])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "def"])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "b.*j"])).toBe(true);
			expect(operator.evaluate(evaluator, ["abcdefghijk", "xyz"])).toBe(false);

			expect(operator.evaluate(evaluator, [null, "abc"])).toBe(null);
			expect(operator.evaluate(evaluator, ["abcdefghijk", null])).toBe(null);
		});
	});
});

/*
		assertTrue((Boolean) operator.evaluate(evaluator, listOf("abcdefghijk", "abc")));
		assertTrue((Boolean) operator.evaluate(evaluator, listOf("abcdefghijk", "ijk")));
		assertTrue((Boolean) operator.evaluate(evaluator, listOf("abcdefghijk", "^abc")));
		assertTrue((Boolean) operator.evaluate(evaluator, listOf(",l5abcdefghijk", "ijk$")));
		assertTrue((Boolean) operator.evaluate(evaluator, listOf("abcdefghijk", "def")));
		assertTrue((Boolean) operator.evaluate(evaluator, listOf("abcdefghijk", "b.*j")));
		assertFalse((Boolean) operator.evaluate(evaluator, listOf("abcdefghijk", "xyz")));

 */
