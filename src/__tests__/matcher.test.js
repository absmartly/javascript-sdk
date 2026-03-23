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
						or: [
							{
								name: "rule1",
								and: [{ eq: [{ var: "country" }, { value: "US" }] }],
								environments: [],
								variant: 1,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(1);
		});

		it("should return null when conditions do not match", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [{ eq: [{ var: "country" }, { value: "US" }] }],
								environments: [],
								variant: 1,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "GB" })).toBe(null);
		});

		it("should skip rules with non-matching environments", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [{ eq: [{ var: "country" }, { value: "US" }] }],
								environments: ["staging"],
								variant: 1,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(null);
		});

		it("should match when environment is in the environments list", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [{ eq: [{ var: "country" }, { value: "US" }] }],
								environments: ["production", "staging"],
								variant: 2,
							},
						],
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
						or: [
							{
								name: "rule1",
								and: [{ value: true }],
								environments: [],
								variant: 1,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(1);
			expect(matcher.evaluateRules(audience, "staging", {})).toBe(1);
			expect(matcher.evaluateRules(audience, null, {})).toBe(1);
		});

		it("should skip rules when environments is non-empty and environmentName is null", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [{ value: true }],
								environments: ["production"],
								variant: 1,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, null, {})).toBe(null);
		});

		it("should return first matching rule (first match wins)", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [{ eq: [{ var: "country" }, { value: "US" }] }],
								environments: [],
								variant: 1,
							},
							{
								name: "rule2",
								and: [{ eq: [{ var: "country" }, { value: "US" }] }],
								environments: [],
								variant: 2,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(1);
		});

		it("should return variant when conditions are empty (matches all)", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [],
								environments: [],
								variant: 3,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(3);
		});

		it("should return variant when and field is absent (matches all)", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								environments: [],
								variant: 3,
							},
						],
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
						or: [
							{
								name: "rule1",
								and: [],
								environments: [],
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(null);
		});

		it("should return null when variant is not a number", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [],
								environments: [],
								variant: "bad",
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(null);
		});

		it("should skip rule with invalid variant and continue to next valid rule", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "bad rule",
								and: [],
								environments: [],
								variant: "not a number",
							},
							{
								name: "good rule",
								and: [],
								environments: [],
								variant: 2,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(2);
		});

		it("should skip rule with missing variant and continue to next valid rule", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "no variant",
								and: [],
								environments: [],
							},
							{
								name: "good rule",
								and: [],
								environments: [],
								variant: 1,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(1);
		});

		it("should handle malformed rules gracefully", () => {
			expect(matcher.evaluateRules('{"rules":"not an array"}', "production", {})).toBe(null);
			expect(matcher.evaluateRules('{"rules":[{"or":"not an array"}]}', "production", {})).toBe(null);
			expect(matcher.evaluateRules('{"rules":[null]}', "production", {})).toBe(null);
		});

		it("should skip to second rule when first does not match", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [{ eq: [{ var: "country" }, { value: "GB" }] }],
								environments: [],
								variant: 1,
							},
							{
								name: "rule2",
								and: [{ eq: [{ var: "country" }, { value: "US" }] }],
								environments: [],
								variant: 2,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(2);
		});

		it("should evaluate second rule group when first has no match", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [{ eq: [{ var: "country" }, { value: "GB" }] }],
								environments: [],
								variant: 1,
							},
						],
					},
					{
						or: [
							{
								name: "rule2",
								and: [{ eq: [{ var: "country" }, { value: "US" }] }],
								environments: [],
								variant: 2,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", { country: "US" })).toBe(2);
		});

		it("should support variant 0", () => {
			const audience = JSON.stringify({
				rules: [
					{
						or: [
							{
								name: "rule1",
								and: [{ value: true }],
								environments: [],
								variant: 0,
							},
						],
					},
				],
			});
			expect(matcher.evaluateRules(audience, "production", {})).toBe(0);
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
