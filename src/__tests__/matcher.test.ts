import { describe, expect, test, it } from "vitest";
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
				filter: [{
					and: [
						{ gte: [{ var: "age" }, { value: 18 }] },
						{ in: [{ value: ["US", "UK"] }, { var: "country" }] },
					],
				}],
			});
			expect(matcher.evaluate(audience, { age: 25, country: "US" })).toBe(true);
			expect(matcher.evaluate(audience, { age: 25, country: "FR" })).toBe(false);
			expect(matcher.evaluate(audience, { age: 15, country: "US" })).toBe(false);
		});

		it("or filter", () => {
			const audience = JSON.stringify({
				filter: [{
					or: [
						{ eq: [{ var: "plan" }, { value: "pro" }] },
						{ eq: [{ var: "plan" }, { value: "enterprise" }] },
					],
				}],
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
});
