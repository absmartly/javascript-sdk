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
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(1);
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
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(2);
			expect(matcher.evaluateRules(audience, "staging", { country: "US" })).toBe(2);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(1);
			expect(matcher.evaluateRules(audience, "staging", {})).toBe(1);
			expect(matcher.evaluateRules(audience, null, {})).toBe(1);
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
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(1);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(3);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(3);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(2);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(1);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(2);
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
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(2);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(0);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(2);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(2);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(2);
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
			expect(matcher.evaluateRules(audience, "production", {})).toBe(-1);
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
