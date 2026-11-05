import { describe, expect, test, it, vi } from "vitest";
import { AudienceMatcher } from "../matcher";

describe("AudienceMatcher", () => {
	const matcher = new AudienceMatcher();

	describe("null/empty handling", () => {
		test("null audience → null", () => {
			expect(matcher.evaluate(null as any, {})).toBe(null);
		});

		test("empty string → null", () => {
			expect(matcher.evaluate("", {})).toBe(null);
		});

		test("returns null for invalid JSON", () => {
			expect(matcher.evaluate("invalid json", {})).toBe(null);
		});

		test("returns null for missing filter", () => {
			expect(matcher.evaluate(JSON.stringify({}), {})).toBe(null);
		});

		test("returns null for null filter", () => {
			expect(matcher.evaluate(JSON.stringify({ filter: null }), {})).toBe(null);
		});
	});

	describe("filter evaluation", () => {
		test("evaluates matching audience", () => {
			const audience = JSON.stringify({ filter: [{ value: true }] });
			expect(matcher.evaluate(audience, {})).toBe(true);
		});

		test("evaluates non-matching audience", () => {
			const audience = JSON.stringify({ filter: [{ value: false }] });
			expect(matcher.evaluate(audience, {})).toBe(false);
		});

		test("evaluates with not operator", () => {
			const audience = JSON.stringify({ filter: [{ not: { value: false } }] });
			expect(matcher.evaluate(audience, {})).toBe(true);
		});

		it("and with all true → true", () => {
			const audience = JSON.stringify({
				filter: [{ and: [{ value: true }, { value: true }] }],
			});
			expect(matcher.evaluate(audience, {})).toBe(true);
		});

		it("and with one false → false", () => {
			const audience = JSON.stringify({
				filter: [{ and: [{ value: true }, { value: false }] }],
			});
			expect(matcher.evaluate(audience, {})).toBe(false);
		});

		it("evaluates with attributes (gte)", () => {
			const audience = JSON.stringify({
				filter: [{ gte: [{ var: "age" }, { value: 18 }] }],
			});
			expect(matcher.evaluate(audience, { age: 25 })).toBe(true);
			expect(matcher.evaluate(audience, { age: 15 })).toBe(false);
		});

		it("complex filter with and+gte+in", () => {
			const audience = JSON.stringify({
				filter: [
					{
						and: [{ gte: [{ var: "age" }, { value: 18 }] }, { in: [{ value: ["US", "UK"] }, { var: "country" }] }],
					},
				],
			});
			expect(matcher.evaluate(audience, { age: 25, country: "US" })).toBe(true);
			expect(matcher.evaluate(audience, { age: 25, country: "FR" })).toBe(false);
			expect(matcher.evaluate(audience, { age: 15, country: "US" })).toBe(false);
		});

		it("or filter", () => {
			const audience = JSON.stringify({
				filter: [
					{
						or: [{ eq: [{ var: "plan" }, { value: "pro" }] }, { eq: [{ var: "plan" }, { value: "enterprise" }] }],
					},
				],
			});
			expect(matcher.evaluate(audience, { plan: "pro" })).toBe(true);
			expect(matcher.evaluate(audience, { plan: "enterprise" })).toBe(true);
			expect(matcher.evaluate(audience, { plan: "free" })).toBe(false);
		});

		it("not filter", () => {
			const audience = JSON.stringify({
				filter: [{ not: { eq: [{ var: "bot" }, { value: true }] } }],
			});
			expect(matcher.evaluate(audience, { bot: false })).toBe(true);
			expect(matcher.evaluate(audience, { bot: true })).toBe(false);
		});

		it("match filter with regex", () => {
			const audience = JSON.stringify({
				filter: [{ match: [{ var: "email" }, { value: ".*@absmartly\\.com$" }] }],
			});
			expect(matcher.evaluate(audience, { email: "user@absmartly.com" })).toBe(true);
			expect(matcher.evaluate(audience, { email: "user@other.com" })).toBe(false);
		});
	});

	describe("evaluateRules", () => {
		it("should return null when no rules in audience", () => {
			expect(matcher.evaluateRules("{}", "production", {})).toBe(null);
			expect(matcher.evaluateRules('{"filter":[]}', "production", {})).toBe(null);
		});

		it("should return null when rules is empty array", () => {
			expect(matcher.evaluateRules('{"rules":[]}', "production", {})).toBe(null);
		});

		it("should return variant when conditions match", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toEqual({ variant: 1 });
		});

		it("should return null when conditions do not match", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "GB" })).toBe(null);
		});

		it("should skip rules with non-matching environment names", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: ["staging"],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(null);
		});

		it("should match when environment name is in the environments list", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: ["production", "staging"],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toEqual({ variant: 2 });
			expect(matcher.evaluateRules(audience, "staging", { country: "US" })).toEqual({ variant: 2 });
		});

		it("should match all environments when environments is empty", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { value: true },
						environments: [],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 1 });
			expect(matcher.evaluateRules(audience, "staging", {})).toEqual({ variant: 1 });
			expect(matcher.evaluateRules(audience, null, {})).toEqual({ variant: 1 });
		});

		it("should skip rules when environments is non-empty and environment name is null", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { value: true },
						environments: ["production"],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, null, {})).toBe(null);
		});

		it("should return first matching rule (first match wins)", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [],
						variant: 1,
					},
					{
						name: "rule2",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toEqual({ variant: 1 });
		});

		it("should return variant when conditions is null (matches all)", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: null,
						environments: [],
						variant: 3,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 3 });
		});

		it("should return variant when conditions field is absent (matches all)", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						environments: [],
						variant: 3,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 3 });
		});

		it("should handle malformed audience JSON gracefully", () => {
			expect(matcher.evaluateRules("not json", "production", {})).toBe(null);
			expect(matcher.evaluateRules("", "production", {})).toBe(null);
		});

		it("should return null when rule has no variant property", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						environments: [],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(null);
		});

		it("should return null when variant is not a number", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						environments: [],
						variant: "bad",
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(null);
		});

		it("should skip rule with invalid variant and continue to next valid rule", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "bad rule",
						type: "assign",
						environments: [],
						variant: "not a number",
					},
					{
						name: "good rule",
						type: "assign",
						environments: [],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 2 });
		});

		it("should skip rule with missing variant and continue to next valid rule", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "no variant",
						type: "assign",
						environments: [],
					},
					{
						name: "good rule",
						type: "assign",
						environments: [],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 1 });
		});

		it("should handle malformed rules gracefully", () => {
			expect(matcher.evaluateRules('{"rules":"not an array"}', "production", {})).toBe(null);
			expect(matcher.evaluateRules('{"rules":[null]}', "production", {})).toBe(null);
		});

		it("should skip rules with non-assign type", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "other",
						environments: [],
						variant: 1,
					},
					{
						name: "rule2",
						type: "assign",
						environments: [],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 2 });
		});

		it("should skip rules with missing type", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						environments: [],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(null);
		});

		it("should skip to second rule when first does not match", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "GB" }] }] },
						environments: [],
						variant: 1,
					},
					{
						name: "rule2",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toEqual({ variant: 2 });
		});

		it("should support variant 0", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { value: true },
						environments: [],
						variant: 0,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 0 });
		});

		it("should skip rule with fractional variant", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						environments: [],
						variant: 1.5,
					},
					{
						name: "rule2",
						type: "assign",
						environments: [],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 2 });
		});

		it("should skip rule with non-object conditions", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: "invalid",
						environments: [],
						variant: 1,
					},
					{
						name: "rule2",
						type: "assign",
						environments: [],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 2 });
		});

		it("should skip rule when environments is not an array", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { value: true },
						environments: "not-an-array",
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(null);
		});

		it("should be case-sensitive when matching environment names", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { value: true },
						environments: ["Production"],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(null);
		});

		it("should skip rule when conditions evaluation throws and continue to next rule", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const evaluateBooleanExpr = vi
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				.spyOn((matcher as any)._jsonExpr, "evaluateBooleanExpr")
				.mockImplementationOnce(() => {
					throw new Error("condition failed");
				});
			const audience = JSON.stringify({
				rules: [
					{
						name: "throws",
						type: "assign",
						conditions: { and: [{ value: true }] },
						environments: [],
						variant: 1,
					},
					{
						name: "fallback",
						type: "assign",
						environments: [],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: 2 });
			expect(evaluateBooleanExpr).toHaveBeenCalledTimes(1);
			expect(warn).toHaveBeenCalledTimes(1);
			evaluateBooleanExpr.mockRestore();
			warn.mockRestore();
		});

		it("should return negative variant (bounds checking is caller responsibility)", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: null,
						environments: [],
						variant: -1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toEqual({ variant: -1 });
		});

		describe("split rules", () => {
			const splitRule = (percentages: unknown) => ({
				name: "split",
				type: "split",
				conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
				environments: [],
				percentages,
			});
			const fallbackRule = { name: "fallback", type: "assign", environments: [], variant: 2 };
			const evaluate = (rules: unknown[]) =>
				matcher.evaluateRules(JSON.stringify({ rules }), "production", { country: "US" });

			it("should return the split as fractions when conditions match", () => {
				expect(evaluate([splitRule("20/30/50")])).toEqual({ split: [0.2, 0.3, 0.5] });
			});

			it("should accept a split whose sum is within the backend tolerance of 100", () => {
				expect(evaluate([splitRule("33.33/33.33/33.33")])).toEqual({ split: [0.3333, 0.3333, 0.3333] });
			});

			it("should return null when split conditions do not match", () => {
				const audience = JSON.stringify({ rules: [splitRule("50/50")] });
				expect(matcher.evaluateRules(audience, "production", { country: "GB" })).toBe(null);
			});

			it("should skip a split rule with non-string percentages and continue to the next rule", () => {
				expect(evaluate([splitRule([50, 50]), fallbackRule])).toEqual({ variant: 2 });
			});

			it("should skip a split rule with non-numeric percentages and continue to the next rule", () => {
				expect(evaluate([splitRule("50/abc"), fallbackRule])).toEqual({ variant: 2 });
			});

			it("should skip a split rule with negative percentages and continue to the next rule", () => {
				expect(evaluate([splitRule("150/-50"), fallbackRule])).toEqual({ variant: 2 });
			});

			it("should skip a split rule whose percentages do not sum to 100 and continue to the next rule", () => {
				expect(evaluate([splitRule("50/49"), fallbackRule])).toEqual({ variant: 2 });
			});

			// Same check as the backend's experiment split: the gap from 100 is rounded to two
			// decimals before being compared with 0.01, so gaps up to 0.0149... are accepted.
			it.each(["50/50.014", "50/49.986"])("should accept %s, whose gap from 100 rounds to 0.01", (percentages) => {
				expect(evaluate([splitRule(percentages), fallbackRule])).toEqual({
					split: percentages.split("/").map((value) => parseFloat(value) / 100),
				});
			});

			it.each(["50/50.015", "50/49.985"])("should skip %s, whose gap from 100 rounds to 0.02", (percentages) => {
				expect(evaluate([splitRule(percentages), fallbackRule])).toEqual({ variant: 2 });
			});
		});
	});
});
