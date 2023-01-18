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
