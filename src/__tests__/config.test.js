import { mergeConfig } from "../config";
import Context from "../context";

jest.mock("../context");

describe("Config", () => {
	describe("mergeConfig()", () => {
		it("should create getters that call treatment", (done) => {
			const context = new Context();

			const mockConfig = {
				d: 5,
				e: 5,
			};

			context.experiments.mockReturnValue(["exp_test"]);
			context.experimentConfig.mockReturnValue(mockConfig);

			const previousConfig = {
				a: 1,
				b: 2,
				c: {
					d: 3,
				},
			};

			const actual = mergeConfig(context, previousConfig);
			expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
			expect(actual).toStrictEqual(previousConfig);

			expect(actual.d).toEqual(mockConfig["d"]);
			expect(context.treatment).toHaveBeenCalledTimes(1);
			expect(context.treatment).toHaveBeenCalledWith("exp_test");
			context.treatment.mockClear();

			expect(actual.e).toEqual(mockConfig["e"]);
			expect(context.treatment).toHaveBeenCalledTimes(1);
			expect(context.treatment).toHaveBeenCalledWith("exp_test");

			done();
		});

		it("should merge dotted keys", (done) => {
			const context = new Context();

			const mockConfig = {
				"c.d": 5,
				"e.f": 5,
			};

			context.experiments.mockReturnValue(["exp_test"]);
			context.experimentConfig.mockReturnValue(mockConfig);

			const previousConfig = {
				a: 1,
				b: 2,
				c: {
					d: 3,
				},
				d: 6,
			};

			const expected = {
				a: 1,
				b: 2,
				c: {
					d: 5,
				},
				d: 6,
				e: {
					//f: 5,
				},
			};

			const actual = mergeConfig(context, previousConfig);
			expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
			expect(actual).toStrictEqual(expected);
			context.treatment.mockClear();

			expect(actual.c.d).toEqual(mockConfig["c.d"]);
			expect(context.treatment).toHaveBeenCalledTimes(1);
			expect(context.treatment).toHaveBeenCalledWith("exp_test");
			context.treatment.mockClear();

			expect(actual.e.f).toEqual(mockConfig["e.f"]);
			expect(context.treatment).toHaveBeenCalledTimes(1);
			expect(context.treatment).toHaveBeenCalledWith("exp_test");
			context.treatment.mockClear();

			done();
		});

		it("should warn about mismatching object merges", (done) => {
			jest.spyOn(console, "warn").mockImplementation(() => {});

			const context = new Context();

			const mockConfig = {
				"b.c.d": 5,
				"c.d": 5,
				"d.e": 5,
				e: {
					f: 5,
				},
			};

			context.experiments.mockReturnValue(["exp_test"]);
			context.experimentConfig.mockReturnValue(mockConfig);

			const previousConfig = {
				a: 1,
				b: {
					c: 3,
				},
				c: 2,
				d: {
					e: {
						f: 3,
					},
				},
				e: 1,
			};

			const expected = {
				a: 1,
				b: {
					c: {
						// d: 5
					},
				},
				c: {
					//d: 5,
				},
				d: {
					e: 5,
				},
				e: {
					f: 5,
				},
			};

			const actual = mergeConfig(context, previousConfig);
			expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
			expect(actual).toStrictEqual(expected);
			context.treatment.mockClear();

			expect(actual.b.c.d).toEqual(mockConfig["b.c.d"]);
			expect(context.treatment).toHaveBeenCalledTimes(1);
			expect(context.treatment).toHaveBeenCalledWith("exp_test");
			context.treatment.mockClear();

			expect(actual.c.d).toEqual(mockConfig["c.d"]);
			expect(context.treatment).toHaveBeenCalledTimes(1);
			expect(context.treatment).toHaveBeenCalledWith("exp_test");
			context.treatment.mockClear();

			expect(actual.d.e).toEqual(mockConfig["d.e"]);
			expect(context.treatment).toHaveBeenCalledTimes(1);
			expect(context.treatment).toHaveBeenCalledWith("exp_test");
			context.treatment.mockClear();

			expect(actual.e).toEqual(mockConfig["e"]);
			expect(context.treatment).toHaveBeenCalledTimes(1);
			expect(context.treatment).toHaveBeenCalledWith("exp_test");
			context.treatment.mockClear();

			expect(console.warn).toHaveBeenCalledTimes(4);
			expect(console.warn).toHaveBeenCalledWith(
				"Config key 'b.c.d' for experiment 'exp_test' is overriding non-object value at 'b.c' with an object."
			);
			expect(console.warn).toHaveBeenCalledWith(
				"Config key 'c.d' for experiment 'exp_test' is overriding non-object value at 'c' with an object."
			);
			expect(console.warn).toHaveBeenCalledWith(
				"Config key 'd.e' for experiment 'exp_test' is overriding object with non-object value."
			);
			expect(console.warn).toHaveBeenCalledWith(
				"Config key 'e' for experiment 'exp_test' is overriding non-object value with object."
			);

			done();
		});

		it("should error with multiple experiments overriding key", (done) => {
			jest.spyOn(console, "error").mockImplementation(() => {});

			const context = new Context();

			const mockConfig = {
				a: 5,
				"b.c.d": 5,
			};

			const mockConfigOverride = {
				a: 4,
				"b.c.d": 4,
			};

			context.experiments.mockReturnValue(["exp_test", "exp_test_override"]);
			context.experimentConfig.mockReturnValueOnce(mockConfig);
			context.experimentConfig.mockReturnValueOnce(mockConfigOverride);

			const previousConfig = {
				a: 1,
				b: {
					c: {
						d: 1,
					},
				},
			};

			const expected = {
				a: 5,
				b: {
					c: {
						d: 5,
					},
				},
			};

			const actual = mergeConfig(context, previousConfig);
			expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
			expect(actual).toStrictEqual(expected);

			expect(console.error).toHaveBeenCalledTimes(2);
			expect(console.error).toHaveBeenCalledWith("Config key 'a' already set by experiment 'exp_test'.");
			expect(console.error).toHaveBeenCalledWith("Config key 'b.c.d' already set by experiment 'exp_test'.");

			done();
		});
	});
});
