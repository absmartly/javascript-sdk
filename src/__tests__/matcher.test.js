import { AudienceMatcher } from "../matcher";

describe("AudienceMatcher", () => {
	const matcher = new AudienceMatcher();

	it("should return null on empty audience", () => {
		expect(matcher.evaluate("", null)).toBe(null);
		expect(matcher.evaluate("{}", null)).toBe(null);
		expect(matcher.evaluate("null", null)).toBe(null);
	});

	it("should return null if filter not object or array", () => {
		expect(matcher.evaluate('{"filter":null}', null)).toBe(null);
		expect(matcher.evaluate('{"filter":false}', null)).toBe(null);
		expect(matcher.evaluate('{"filter":5}', null)).toBe(null);
		expect(matcher.evaluate('{"filter":"a"}', null)).toBe(null);
	});

	it("should return boolean", () => {
		expect(matcher.evaluate('{"filter":[{"value":5}]}', null)).toBe(true);
		expect(matcher.evaluate('{"filter":[{"value":true}]}', null)).toBe(true);
		expect(matcher.evaluate('{"filter":[{"value":1}]}', null)).toBe(true);
		expect(matcher.evaluate('{"filter":[{"value":null}]}', null)).toBe(false);
		expect(matcher.evaluate('{"filter":[{"value":0}]}', null)).toBe(false);

		expect(matcher.evaluate('{"filter":[{"not":{"var":"returning"}}]}', { returning: true })).toBe(false);
		expect(matcher.evaluate('{"filter":[{"not":{"var":"returning"}}]}', { returning: false })).toBe(true);
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
			const audience = JSON.stringify({
				rules: [
					{
						name: "throws",
						type: "assign",
						conditions: { badOperator: [1, 2] },
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
			const splitRule = (percentages) => ({
				name: "split",
				type: "split",
				conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
				environments: [],
				percentages,
			});
			const fallbackRule = { name: "fallback", type: "assign", environments: [], variant: 2 };
			const evaluate = (rules) =>
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
			it.each(["50/50.014", "50/49.986"])(
				"should accept %s, whose gap from 100 rounds to 0.01",
				(percentages) => {
					expect(evaluate([splitRule(percentages), fallbackRule])).toEqual({
						split: percentages.split("/").map((value) => parseFloat(value) / 100),
					});
				}
			);

			it.each(["50/50.015", "50/49.985"])("should skip %s, whose gap from 100 rounds to 0.02", (percentages) => {
				expect(evaluate([splitRule(percentages), fallbackRule])).toEqual({ variant: 2 });
			});
		});
	});
});

/*

	@Test
	void evaluateReturnsNullIfFilterNotMapOrList() {
		assertNull(matcher.evaluate("{\"filter\":5}", null));
	}

	@Test
	void evaluateReturnsBoolean() {
		assertTrue(matcher.evaluate("{\"filter\":[{\"value\":5}]}", null));
		assertTrue(matcher.evaluate("{\"filter\":[{\"value\":true}]}", null));
		assertTrue(matcher.evaluate("{\"filter\":[{\"value\":1}]}", null));
		assertFalse(matcher.evaluate("{\"filter\":[{\"value\":null}]}", null));
		assertFalse(matcher.evaluate("{\"filter\":[{\"value\":0}]}", null));

		assertFalse(matcher.evaluate("{\"filter\":[{\"not\":{\"var\":\"returning\"}}]}", mapOf("returning", true)));
		assertTrue(matcher.evaluate("{\"filter\":[{\"not\":{\"var\":\"returning\"}}]}", mapOf("returning", false)));
	}
 */
