import { mergeConfig } from "../config";
import Context from "../context";

jest.mock("../context");

describe("Config", () => {
	describe("mergeConfig()", () => {
		it("should create getters that call context.variable()", (done) => {
			const context = new Context();

			const variableKeys = {
				"button": "exp_test_abc",
				"banner.border": "exp_test_ab",
				"banner.size": "exp_test_ab",
				"home.arrow.direction": "exp_test_arrow"
			};

			const expectedValues = {
				"button": true,
				"banner.border": 10,
				"banner.size": 812,
				"home.arrow.direction": "up"
			};

			context.variableKeys.mockReturnValue(variableKeys);
			context.variableValue.mockImplementation((key) => expectedValues[key]);

			const previousConfig = {
				"button": false,
				"banner": {
					"size": 420,
					"border": 0,
				},
				"home": {
					"arrow": {
						"direction": "down"
					}
				},
				"other": "unused"
			};

			const expectedConfig = {
				"button": true,
				"banner": {
					"size": 812,
					"border": 10,
				},
				"home": {
					"arrow": {
						"direction": "up"
					}
				},
				"other": "unused"
			};

			const actual = mergeConfig(context, previousConfig);
			expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
			expect(actual).toMatchObject(expectedConfig);
			expect(context.variableValue).toHaveBeenCalledTimes(4); // called during equality check above
			context.variableValue.mockClear();

			expect(actual.button).toEqual(expectedConfig.button);
			expect(context.variableValue).toHaveBeenCalledTimes(1);
			expect(context.variableValue).toHaveBeenCalledWith("button", previousConfig.button);
			context.variableValue.mockClear();

			expect(actual.banner.border).toEqual(expectedConfig.banner.border);
			expect(context.variableValue).toHaveBeenCalledTimes(1);
			expect(context.variableValue).toHaveBeenCalledWith("banner.border", previousConfig.banner.border);
			context.variableValue.mockClear();

			expect(actual.banner.size).toEqual(expectedConfig.banner.size);
			expect(context.variableValue).toHaveBeenCalledTimes(1);
			expect(context.variableValue).toHaveBeenCalledWith("banner.size", previousConfig.banner.size);
			context.variableValue.mockClear();

			expect(actual.home.arrow.direction).toEqual(expectedConfig.home.arrow.direction);
			expect(context.variableValue).toHaveBeenCalledTimes(1);
			expect(context.variableValue).toHaveBeenCalledWith("home.arrow.direction", previousConfig.home.arrow.direction);
			context.variableValue.mockClear();

			expect(actual.other).toEqual(expectedConfig.other);
			expect(context.variableValue).toHaveBeenCalledTimes(0);

			done();
		});

		it("should warn about mismatching object merges", (done) => {
			jest.spyOn(console, "warn").mockImplementation(() => {});

			const context = new Context();

			const variableKeys = {
				"button.active": "exp_test_abc",
				"banner.border": "exp_test_ab",
				"banner.size": "exp_test_ab",
				"home.arrow.direction": "exp_test_arrow"
			};

			const expectedValues = {
				"button.active": true,
				"banner.border": 10,
				"banner.size": 812,
				"home.arrow.direction": "up"
			};

			context.variableKeys.mockReturnValue(variableKeys);
			context.variableValue.mockImplementation((key) => expectedValues[key]);

			const previousConfig = {
				"button": true,
				"banner": {
					"size": 420,
					"border": 0,
				},
				"home": {
					"arrow": "down"
				},
				"other": "unused"
			};

			const expectedConfig = {
				"button": {
					"active": true,
				},
				"banner": {
					"size": 812,
					"border": 10,
				},
				"home": {
					"arrow": {
						"direction": "up",
					}
				},
				"other": "unused"
			};

			const actual = mergeConfig(context, previousConfig);
			expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
			expect(actual).toMatchObject(expectedConfig);
			expect(context.variableValue).toHaveBeenCalledTimes(4); // called during equality check above
			context.variableValue.mockClear();

			expect(console.warn).toHaveBeenCalledTimes(2);
			expect(console.warn).toHaveBeenCalledWith(
				"Config key 'button.active' for experiment 'exp_test_abc' is overriding non-object value at 'button' with an object."
			);
			expect(console.warn).toHaveBeenCalledWith(
				"Config key 'home.arrow.direction' for experiment 'exp_test_arrow' is overriding non-object value at 'home.arrow' with an object."
			);

			expect(actual.button.active).toEqual(expectedConfig.button.active);
			expect(context.variableValue).toHaveBeenCalledTimes(1);
			expect(context.variableValue).toHaveBeenCalledWith("button.active", undefined);
			context.variableValue.mockClear();

			expect(actual.home.arrow.direction).toEqual(expectedConfig.home.arrow.direction);
			expect(context.variableValue).toHaveBeenCalledTimes(1);
			expect(context.variableValue).toHaveBeenCalledWith("home.arrow.direction", undefined);
			context.variableValue.mockClear();

			done();
		});

		it("should error with multiple experiments overriding key", (done) => {
			jest.spyOn(console, "error").mockImplementation(() => {});

			jest.spyOn(console, "warn").mockImplementation(() => {});

			const context = new Context();

			const variableKeys = {
				"button.active": true,
				"banner.border": "exp_test_ab",
				"banner.size": "exp_test_abc",
				"home.arrow": "exp_test_arrow",
				"home.arrow.direction": "exp_test_arrow_direction"
			};

			const expectedValues = {
				"button.active": true,
				"banner.border": 10,
				"banner.size": 812,
				"home.arrow": "up",
				"home.arrow.direction": "up"
			};

			context.variableKeys.mockReturnValue(variableKeys);
			context.variableValue.mockImplementation((key) => expectedValues[key]);

			const previousConfig = {
				"button": {
					"active": false
				},
				"banner": {
					"size": 420,
					"border": 0,
				},
				"home": {
					"arrow": "down"
				},
				"other": "unused"
			};

			const expectedConfig = {
				"button": {
					"active": true,
				},
				"banner": {
					"size": 812,
					"border": 10,
				},
				"home": {
					"arrow": "up"
				},
				"other": "unused"
			};

			const actual = mergeConfig(context, previousConfig);
			expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
			expect(actual).toMatchObject(expectedConfig);
			expect(context.variableValue).toHaveBeenCalledTimes(4); // called during equality check above
			context.variableValue.mockClear();

			expect(console.error).toHaveBeenCalledTimes(1);
			expect(console.error).toHaveBeenCalledWith("Config key 'home.arrow' already set by experiment 'exp_test_arrow'.");

			done();
		});
	});
});
