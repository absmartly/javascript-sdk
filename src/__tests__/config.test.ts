import { describe, expect, test, vi } from "vitest";
import { mergeConfig } from "../config";

function mockContext(
	variableKeys: Record<string, string[]>,
	variableValues: Record<string, unknown> = {},
) {
	return {
		variableKeys: () => variableKeys,
		variableValue: (key: string, defaultValue: unknown) =>
			key in variableValues ? variableValues[key] : defaultValue,
	};
}

describe("mergeConfig", () => {
	test("returns new object, does not mutate original", () => {
		const original = { key: "value" };
		const context = mockContext({});
		const result = mergeConfig(context as never, original);
		expect(result).not.toBe(original);
		expect(result).toEqual({ key: "value" });
	});

	test("creates getter for experiment variable", () => {
		const context = mockContext({ "button.color": ["exp_test"] }, { "button.color": "red" });
		const config = { button: { color: "blue" } };
		const result = mergeConfig(context as never, config);
		expect(result.button).toBeDefined();
		expect((result.button as Record<string, unknown>).color).toBe("red");
	});

	test("falls back to default when variable not set", () => {
		const context = mockContext({ "button.color": ["exp_test"] });
		const config = { button: { color: "blue" } };
		const result = mergeConfig(context as never, config);
		expect((result.button as Record<string, unknown>).color).toBe("blue");
	});

	test("warns when overriding non-object value with object", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const context = mockContext({ "button.active.color": ["exp_test"] });
		const config = { button: { active: "yes" } };
		mergeConfig(context as never, config);
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	test("errors when key already set by another experiment", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const context = mockContext({
			"button.color": ["exp_test_1"],
			"button.color.shade": ["exp_test_2"],
		});
		const config = { button: { color: "blue" } };
		mergeConfig(context as never, config);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
