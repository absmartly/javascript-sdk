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
			expect(matcher.evaluateRules("{}", 1, {})).toBe(null);
			expect(matcher.evaluateRules('{"filter":[]}', 1, {})).toBe(null);
		});

		it("should return null when rules is empty array", () => {
			expect(matcher.evaluateRules('{"rules":[]}', 1, {})).toBe(null);
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
			expect(matcher.evaluateRules(audience, 1, { country: "US" })).toBe(1);
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
			expect(matcher.evaluateRules(audience, 1, { country: "GB" })).toBe(null);
		});

		it("should skip rules with non-matching environment ids", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [2],
						variant: 1,
					},
				],
			});
			expect(matcher.evaluateRules(audience, 1, { country: "US" })).toBe(null);
		});

		it("should match when environment id is in the environments list", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { and: [{ eq: [{ var: "country" }, { value: "US" }] }] },
						environments: [1, 2],
						variant: 2,
					},
				],
			});
			expect(matcher.evaluateRules(audience, 1, { country: "US" })).toBe(2);
			expect(matcher.evaluateRules(audience, 2, { country: "US" })).toBe(2);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(1);
			expect(matcher.evaluateRules(audience, 2, {})).toBe(1);
			expect(matcher.evaluateRules(audience, null, {})).toBe(1);
		});

		it("should skip rules when environments is non-empty and environmentId is null", () => {
			const audience = JSON.stringify({
				rules: [
					{
						name: "rule1",
						type: "assign",
						conditions: { value: true },
						environments: [1],
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
			expect(matcher.evaluateRules(audience, 1, { country: "US" })).toBe(1);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(3);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(3);
		});

		it("should handle malformed audience JSON gracefully", () => {
			expect(matcher.evaluateRules("not json", 1, {})).toBe(null);
			expect(matcher.evaluateRules("", 1, {})).toBe(null);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(null);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(null);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(2);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(1);
		});

		it("should handle malformed rules gracefully", () => {
			expect(matcher.evaluateRules('{"rules":"not an array"}', 1, {})).toBe(null);
			expect(matcher.evaluateRules('{"rules":[null]}', 1, {})).toBe(null);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(2);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(null);
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
			expect(matcher.evaluateRules(audience, 1, { country: "US" })).toBe(2);
		});

		it("should skip to later rule when earlier rules do not match", () => {
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
			expect(matcher.evaluateRules(audience, 1, { country: "US" })).toBe(2);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(0);
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
			expect(matcher.evaluateRules(audience, 1, {})).toBe(2);
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
