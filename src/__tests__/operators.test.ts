import { describe, it, expect } from "vitest";
import { Evaluator } from "../jsonexpr/evaluator";
import {
	AndCombinator,
	EqualsOperator,
	GreaterThanOperator,
	GreaterThanOrEqualOperator,
	InOperator,
	LessThanOperator,
	LessThanOrEqualOperator,
	MatchOperator,
	NotOperator,
	NullOperator,
	OrCombinator,
	ValueOperator,
	VarOperator,
} from "../jsonexpr/operators";

const operators = {
	and: new AndCombinator(),
	or: new OrCombinator(),
	value: new ValueOperator(),
	var: new VarOperator(),
	null: new NullOperator(),
	not: new NotOperator(),
	in: new InOperator(),
	match: new MatchOperator(),
	eq: new EqualsOperator(),
	gt: new GreaterThanOperator(),
	gte: new GreaterThanOrEqualOperator(),
	lt: new LessThanOperator(),
	lte: new LessThanOrEqualOperator(),
};

function evalExpr(expr: unknown, vars: Record<string, unknown> = {}): unknown {
	const e = new Evaluator(operators, vars);
	return e.evaluate(expr);
}

describe("operators", () => {
	describe("value", () => {
		it("returns literal", () => expect(evalExpr({ value: 42 })).toBe(42));
		it("returns string", () => expect(evalExpr({ value: "hello" })).toBe("hello"));
		it("returns null", () => expect(evalExpr({ value: null })).toBe(null));
		it("returns boolean", () => expect(evalExpr({ value: true })).toBe(true));
	});

	// NOTE: Branch VarOperator expects path string or {path: "..."}, not {value: "..."}
	describe("var", () => {
		it("extracts variable by path string", () => {
			expect(evalExpr({ var: "x" }, { x: 99 })).toBe(99);
		});
		it("extracts nested via slash-separated path", () => {
			expect(evalExpr({ var: "a/b" }, { a: { b: 5 } } as any)).toBe(5);
		});
		it("missing returns null", () => {
			expect(evalExpr({ var: "z" }, { x: 1 })).toBe(null);
		});
		it("extracts via object with path property", () => {
			expect(evalExpr({ var: { path: "x" } as unknown }, { x: 42 })).toBe(42);
		});
	});

	describe("and", () => {
		it("empty → true", () => expect(evalExpr({ and: [] })).toBe(true));
		it("all true → true", () => expect(evalExpr({ and: [{ value: true }, { value: 1 }] })).toBe(true));
		it("any false → false", () => expect(evalExpr({ and: [{ value: true }, { value: false }] })).toBe(false));
		it("all false → false", () => expect(evalExpr({ and: [{ value: false }, { value: 0 }] })).toBe(false));
	});

	// NOTE: Branch OrCombinator returns true for empty array (vacuous truth), matching AndCombinator
	describe("or", () => {
		it("empty → true (vacuous)", () => expect(evalExpr({ or: [] })).toBe(true));
		it("any true → true", () => expect(evalExpr({ or: [{ value: false }, { value: true }] })).toBe(true));
		it("all false → false", () => expect(evalExpr({ or: [{ value: false }, { value: 0 }] })).toBe(false));
		it("first true → true", () => expect(evalExpr({ or: [{ value: true }, { value: false }] })).toBe(true));
	});

	describe("not", () => {
		it("true → false", () => expect(evalExpr({ not: { value: true } })).toBe(false));
		it("false → true", () => expect(evalExpr({ not: { value: false } })).toBe(true));
		it("1 → false", () => expect(evalExpr({ not: { value: 1 } })).toBe(false));
		it("0 → true", () => expect(evalExpr({ not: { value: 0 } })).toBe(true));
		it("null → true", () => expect(evalExpr({ not: { value: null } })).toBe(true));
	});

	describe("null", () => {
		it("null → true", () => expect(evalExpr({ null: { value: null } })).toBe(true));
		it("0 → false", () => expect(evalExpr({ null: { value: 0 } })).toBe(false));
		it("'' → false", () => expect(evalExpr({ null: { value: "" } })).toBe(false));
		it("false → false", () => expect(evalExpr({ null: { value: false } })).toBe(false));
	});

	// NOTE: BinaryOperator base returns null if lhs is null, so eq(null, null) → null
	describe("eq", () => {
		it("null == null → null (null short-circuits)", () =>
			expect(evalExpr({ eq: [{ value: null }, { value: null }] })).toBe(null));
		it("null == 0 → null", () => expect(evalExpr({ eq: [{ value: null }, { value: 0 }] })).toBe(null));
		it("0 == 0 → true", () => expect(evalExpr({ eq: [{ value: 0 }, { value: 0 }] })).toBe(true));
		it("1 == 0 → false", () => expect(evalExpr({ eq: [{ value: 1 }, { value: 0 }] })).toBe(false));
		it("'a' == 'a' → true", () => expect(evalExpr({ eq: [{ value: "a" }, { value: "a" }] })).toBe(true));
		it("'a' == 'b' → false", () => expect(evalExpr({ eq: [{ value: "a" }, { value: "b" }] })).toBe(false));
		it("true == true → true", () => expect(evalExpr({ eq: [{ value: true }, { value: true }] })).toBe(true));
		it("true == false → false", () => expect(evalExpr({ eq: [{ value: true }, { value: false }] })).toBe(false));
	});

	describe("gt", () => {
		it("1 > 0 → true", () => expect(evalExpr({ gt: [{ value: 1 }, { value: 0 }] })).toBe(true));
		it("0 > 1 → false", () => expect(evalExpr({ gt: [{ value: 0 }, { value: 1 }] })).toBe(false));
		it("0 > 0 → false", () => expect(evalExpr({ gt: [{ value: 0 }, { value: 0 }] })).toBe(false));
		it("null > 0 → null", () => expect(evalExpr({ gt: [{ value: null }, { value: 0 }] })).toBe(null));
		it("'b' > 'a' → true", () => expect(evalExpr({ gt: [{ value: "b" }, { value: "a" }] })).toBe(true));
	});

	describe("gte", () => {
		it("1 >= 0 → true", () => expect(evalExpr({ gte: [{ value: 1 }, { value: 0 }] })).toBe(true));
		it("0 >= 0 → true", () => expect(evalExpr({ gte: [{ value: 0 }, { value: 0 }] })).toBe(true));
		it("0 >= 1 → false", () => expect(evalExpr({ gte: [{ value: 0 }, { value: 1 }] })).toBe(false));
	});

	describe("lt", () => {
		it("0 < 1 → true", () => expect(evalExpr({ lt: [{ value: 0 }, { value: 1 }] })).toBe(true));
		it("1 < 0 → false", () => expect(evalExpr({ lt: [{ value: 1 }, { value: 0 }] })).toBe(false));
		it("0 < 0 → false", () => expect(evalExpr({ lt: [{ value: 0 }, { value: 0 }] })).toBe(false));
	});

	describe("lte", () => {
		it("0 <= 1 → true", () => expect(evalExpr({ lte: [{ value: 0 }, { value: 1 }] })).toBe(true));
		it("0 <= 0 → true", () => expect(evalExpr({ lte: [{ value: 0 }, { value: 0 }] })).toBe(true));
		it("1 <= 0 → false", () => expect(evalExpr({ lte: [{ value: 1 }, { value: 0 }] })).toBe(false));
	});

	// NOTE: Branch InOperator signature is (haystack, needle) — first arg is the collection
	describe("in", () => {
		it("string contains", () => {
			expect(evalExpr({ in: [{ value: "abcdef" }, { value: "bc" }] })).toBe(true);
		});
		it("string not contains", () => {
			expect(evalExpr({ in: [{ value: "abcdef" }, { value: "xyz" }] })).toBe(false);
		});
		it("array contains", () => {
			expect(evalExpr({ in: [{ value: [1, 2, 3] }, { value: 2 }] })).toBe(true);
		});
		it("array not contains", () => {
			expect(evalExpr({ in: [{ value: [1, 2, 3] }, { value: 4 }] })).toBe(false);
		});
		it("null haystack → null", () => {
			expect(evalExpr({ in: [{ value: null }, { value: "a" }] })).toBe(null);
		});
		it("object key exists", () => {
			expect(evalExpr({ in: [{ value: { a: 1, b: 2 } }, { value: "a" }] })).toBe(true);
		});
		it("object key missing", () => {
			expect(evalExpr({ in: [{ value: { a: 1, b: 2 } }, { value: "c" }] })).toBe(false);
		});
	});

	describe("match", () => {
		it("matches regex", () => {
			expect(evalExpr({ match: [{ value: "hello world" }, { value: "hello.*" }] })).toBe(true);
		});
		it("no match", () => {
			expect(evalExpr({ match: [{ value: "hello" }, { value: "^world$" }] })).toBe(false);
		});
		it("null text → null", () => {
			expect(evalExpr({ match: [{ value: null }, { value: "abc" }] })).toBe(null);
		});
		it("null pattern → null", () => {
			expect(evalExpr({ match: [{ value: "hello" }, { value: null }] })).toBe(null);
		});
		it("invalid regex → null", () => {
			expect(evalExpr({ match: [{ value: "hello" }, { value: "[invalid" }] })).toBe(null);
		});
	});

	describe("complex expressions", () => {
		it("nested and/or", () => {
			const expr = {
				and: [
					{ or: [{ value: true }, { value: false }] },
					{ not: { value: false } },
				],
			};
			expect(evalExpr(expr)).toBe(true);
		});

		it("variable comparison", () => {
			const expr = { gt: [{ var: "age" }, { value: 18 }] };
			expect(evalExpr(expr, { age: 25 })).toBe(true);
			expect(evalExpr(expr, { age: 15 })).toBe(false);
		});

		it("audience-like filter", () => {
			const expr = {
				and: [
					{ gte: [{ var: "age" }, { value: 18 }] },
					{ in: [{ value: ["US", "UK", "CA"] }, { var: "country" }] },
				],
			};
			expect(evalExpr(expr, { age: 25, country: "US" })).toBe(true);
			expect(evalExpr(expr, { age: 25, country: "FR" })).toBe(false);
			expect(evalExpr(expr, { age: 15, country: "US" })).toBe(false);
		});
	});
});
