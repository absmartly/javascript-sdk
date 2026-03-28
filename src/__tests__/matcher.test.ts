import { describe, expect, test } from "vitest";
import { AudienceMatcher } from "../matcher";

describe("AudienceMatcher", () => {
	const matcher = new AudienceMatcher();

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
