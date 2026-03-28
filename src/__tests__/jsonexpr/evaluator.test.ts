import { describe, expect, test } from "vitest";
import { Evaluator } from "../../jsonexpr/evaluator";

function createEvaluator(vars: Record<string, unknown> = {}) {
	return new Evaluator({}, vars);
}

describe("Evaluator", () => {
	describe("booleanConvert", () => {
		const evaluator = createEvaluator();

		test("boolean values", () => {
			expect(evaluator.booleanConvert(true)).toBe(true);
			expect(evaluator.booleanConvert(false)).toBe(false);
		});

		test("number values", () => {
			expect(evaluator.booleanConvert(1)).toBe(true);
			expect(evaluator.booleanConvert(0)).toBe(false);
			expect(evaluator.booleanConvert(-1)).toBe(true);
		});

		test("string values", () => {
			expect(evaluator.booleanConvert("true")).toBe(true);
			expect(evaluator.booleanConvert("false")).toBe(false);
			expect(evaluator.booleanConvert("0")).toBe(false);
			expect(evaluator.booleanConvert("")).toBe(false);
			expect(evaluator.booleanConvert("abc")).toBe(true);
		});

		test("null/undefined", () => {
			expect(evaluator.booleanConvert(null)).toBe(false);
			expect(evaluator.booleanConvert(undefined)).toBe(false);
		});
	});

	describe("numberConvert", () => {
		const evaluator = createEvaluator();

		test("number values", () => {
			expect(evaluator.numberConvert(42)).toBe(42);
			expect(evaluator.numberConvert(0)).toBe(0);
			expect(evaluator.numberConvert(-1.5)).toBe(-1.5);
		});

		test("boolean values", () => {
			expect(evaluator.numberConvert(true)).toBe(1);
			expect(evaluator.numberConvert(false)).toBe(0);
		});

		test("string values", () => {
			expect(evaluator.numberConvert("42")).toBe(42);
			expect(evaluator.numberConvert("3.14")).toBe(3.14);
			expect(evaluator.numberConvert("abc")).toBe(null);
		});

		test("other types", () => {
			expect(evaluator.numberConvert(null)).toBe(null);
			expect(evaluator.numberConvert({})).toBe(null);
		});
	});

	describe("stringConvert", () => {
		const evaluator = createEvaluator();

		test("string values", () => {
			expect(evaluator.stringConvert("hello")).toBe("hello");
		});

		test("boolean values", () => {
			expect(evaluator.stringConvert(true)).toBe("true");
			expect(evaluator.stringConvert(false)).toBe("false");
		});

		test("number values", () => {
			expect(evaluator.stringConvert(42)).toBe("42");
			expect(evaluator.stringConvert(0)).toBe("0");
		});

		test("other types", () => {
			expect(evaluator.stringConvert(null)).toBe(null);
			expect(evaluator.stringConvert({})).toBe(null);
		});
	});

	describe("extractVar", () => {
		test("extracts top-level variable", () => {
			const evaluator = createEvaluator({ name: "John" });
			expect(evaluator.extractVar("name")).toBe("John");
		});

		test("extracts nested variable", () => {
			const evaluator = createEvaluator({ user: { name: "John" } });
			expect(evaluator.extractVar("user/name")).toBe("John");
		});

		test("returns null for missing path", () => {
			const evaluator = createEvaluator({ name: "John" });
			expect(evaluator.extractVar("missing")).toBe(null);
		});
	});

	describe("compare", () => {
		const evaluator = createEvaluator();

		test("numbers", () => {
			expect(evaluator.compare(1, 2)).toBe(-1);
			expect(evaluator.compare(2, 1)).toBe(1);
			expect(evaluator.compare(1, 1)).toBe(0);
		});

		test("strings", () => {
			expect(evaluator.compare("a", "b")).toBe(-1);
			expect(evaluator.compare("b", "a")).toBe(1);
			expect(evaluator.compare("a", "a")).toBe(0);
		});

		test("booleans", () => {
			expect(evaluator.compare(true, true)).toBe(0);
			expect(evaluator.compare(false, false)).toBe(0);
		});

		test("null handling", () => {
			expect(evaluator.compare(null, null)).toBe(0);
			expect(evaluator.compare(null, 1)).toBe(null);
			expect(evaluator.compare(1, null)).toBe(null);
		});
	});

	describe("versionCompare", () => {
		const evaluator = createEvaluator();

		test("equal versions", () => {
			expect(evaluator.versionCompare("1.0.0", "1.0.0")).toBe(0);
		});

		test("greater version", () => {
			expect(evaluator.versionCompare("2.0.0", "1.0.0")).toBe(1);
		});

		test("lesser version", () => {
			expect(evaluator.versionCompare("1.0.0", "2.0.0")).toBe(-1);
		});

		test("prerelease is less than release", () => {
			expect(evaluator.versionCompare("1.0.0-alpha", "1.0.0")).toBe(-1);
		});

		test("v prefix", () => {
			expect(evaluator.versionCompare("v1.0.0", "1.0.0")).toBe(0);
		});

		test("build metadata ignored", () => {
			expect(evaluator.versionCompare("1.0.0+build1", "1.0.0+build2")).toBe(0);
		});

		test("null inputs", () => {
			expect(evaluator.versionCompare(null, "1.0.0")).toBe(null);
			expect(evaluator.versionCompare("1.0.0", null)).toBe(null);
		});

		test("empty inputs", () => {
			expect(evaluator.versionCompare("", "1.0.0")).toBe(null);
			expect(evaluator.versionCompare("1.0.0", "")).toBe(null);
		});
	});
});
