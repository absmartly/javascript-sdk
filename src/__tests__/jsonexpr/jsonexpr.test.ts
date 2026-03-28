import { describe, expect, test } from "vitest";
import { JsonExpr } from "../../jsonexpr/jsonexpr";

describe("JsonExpr", () => {
	const jsonExpr = new JsonExpr();

	test("evaluateBooleanExpr with and-array", () => {
		expect(jsonExpr.evaluateBooleanExpr([{ value: true }, { value: 1 }], {})).toBe(true);
		expect(jsonExpr.evaluateBooleanExpr([{ value: true }, { value: false }], {})).toBe(false);
	});

	test("evaluateBooleanExpr with object expr", () => {
		expect(jsonExpr.evaluateBooleanExpr({ value: true }, {})).toBe(true);
		expect(jsonExpr.evaluateBooleanExpr({ value: false }, {})).toBe(false);
	});

	test("evaluateExpr returns raw value", () => {
		expect(jsonExpr.evaluateExpr({ value: 42 }, {})).toBe(42);
		expect(jsonExpr.evaluateExpr({ value: "hello" }, {})).toBe("hello");
	});

	test("var operator extracts from vars", () => {
		expect(jsonExpr.evaluateExpr({ var: "name" }, { name: "Alice" })).toBe("Alice");
	});

	test("complex expression with eq and var", () => {
		const expr = { eq: [{ var: "age" }, { value: 25 }] };
		expect(jsonExpr.evaluateBooleanExpr(expr, { age: 25 })).toBe(true);
		expect(jsonExpr.evaluateBooleanExpr(expr, { age: 30 })).toBe(false);
	});
});
