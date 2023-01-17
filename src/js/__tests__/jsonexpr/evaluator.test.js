import { Evaluator } from "../../jsonexpr/evaluator";

describe("Evaluator", () => {
	describe("evaluate", () => {
		it("should consider an array as implicit AND combinator", () => {
			const and = { evaluate: jest.fn().mockReturnValue(true) };
			const or = { evaluate: jest.fn().mockReturnValue(true) };

			const evaluator = new Evaluator({ and, or }, {});
			const args = [{ value: true }, { value: false }];
			expect(evaluator.evaluate(args)).not.toBe(null);

			expect(and.evaluate).toHaveBeenCalledTimes(1);
			expect(and.evaluate).toHaveBeenCalledWith(evaluator, args);
			expect(or.evaluate).not.toHaveBeenCalled();
		});

		it("should return null if operator not found", () => {
			const value = { evaluate: jest.fn().mockReturnValue(true) };

			const evaluator = new Evaluator({ value }, {});
			expect(evaluator.evaluate({ not_found: true })).toBe(null);

			expect(value.evaluate).not.toHaveBeenCalled();
		});

		it("should call operator evaluate will args", () => {
			const value = { evaluate: jest.fn().mockReturnValue(true) };

			const evaluator = new Evaluator({ value }, {});
			const args = [1, 2, 3];
			expect(evaluator.evaluate({ value: args })).toBe(true);

			expect(value.evaluate).toHaveBeenCalledTimes(1);
			expect(value.evaluate).toHaveBeenCalledWith(evaluator, args);
		});
	});

	describe("booleanConvert()", () => {
		it("should convert all types of values to boolean", () => {
			const evaluator = new Evaluator({}, {});

			expect(evaluator.booleanConvert({})).toBe(true);
			expect(evaluator.booleanConvert([])).toBe(true);
			expect(evaluator.booleanConvert(null)).toBe(false);

			expect(evaluator.booleanConvert(true)).toBe(true);
			expect(evaluator.booleanConvert(1)).toBe(true);
			expect(evaluator.booleanConvert(2)).toBe(true);
			expect(evaluator.booleanConvert("abc")).toBe(true);
			expect(evaluator.booleanConvert("1")).toBe(true);

			expect(evaluator.booleanConvert(false)).toBe(false);
			expect(evaluator.booleanConvert(0)).toBe(false);
			expect(evaluator.booleanConvert("")).toBe(false);
			expect(evaluator.booleanConvert("0")).toBe(false);
			expect(evaluator.booleanConvert("false")).toBe(false);
		});
	});

	describe("numberConvert()", () => {
		it("should convert boolean, and numeric strings to number", () => {
			const evaluator = new Evaluator({}, {});

			expect(evaluator.numberConvert(null)).toBe(null);
			expect(evaluator.numberConvert({})).toBe(null);
			expect(evaluator.numberConvert([])).toBe(null);
			expect(evaluator.numberConvert("")).toBe(null);
			expect(evaluator.numberConvert("abc")).toBe(null);
			expect(evaluator.numberConvert("x1234")).toBe(null);

			expect(evaluator.numberConvert(true)).toBe(1.0);
			expect(evaluator.numberConvert(false)).toBe(0.0);

			expect(evaluator.numberConvert(-1.0)).toBe(-1.0);
			expect(evaluator.numberConvert(0.0)).toBe(0.0);
			expect(evaluator.numberConvert(1.0)).toBe(1.0);
			expect(evaluator.numberConvert(1.5)).toBe(1.5);
			expect(evaluator.numberConvert(2.0)).toBe(2.0);
			expect(evaluator.numberConvert(3.0)).toBe(3.0);

			expect(evaluator.numberConvert(-1)).toBe(-1.0);
			expect(evaluator.numberConvert(0)).toBe(0.0);
			expect(evaluator.numberConvert(1)).toBe(1.0);
			expect(evaluator.numberConvert(2)).toBe(2.0);
			expect(evaluator.numberConvert(3)).toBe(3.0);

			expect(evaluator.numberConvert(0x7fffffff)).toBe(2147483647.0);
			expect(evaluator.numberConvert(-0x7fffffff)).toBe(-2147483647.0);
			expect(evaluator.numberConvert(Number.MAX_SAFE_INTEGER)).toBe(9007199254740991.0);
			expect(evaluator.numberConvert(-Number.MAX_SAFE_INTEGER)).toBe(-9007199254740991.0);

			expect(evaluator.numberConvert("-1")).toBe(-1.0);
			expect(evaluator.numberConvert("0")).toBe(0.0);
			expect(evaluator.numberConvert("1")).toBe(1.0);
			expect(evaluator.numberConvert("1.5")).toBe(1.5);
			expect(evaluator.numberConvert("2")).toBe(2.0);
			expect(evaluator.numberConvert("3.0")).toBe(3.0);
		});
	});

	describe("stringConvert()", () => {
		const evaluator = new Evaluator({}, {});

		expect(evaluator.stringConvert(null)).toBe(null);
		expect(evaluator.stringConvert({})).toBe(null);
		expect(evaluator.stringConvert([])).toBe(null);

		expect(evaluator.stringConvert(true)).toBe("true");
		expect(evaluator.stringConvert(false)).toBe("false");

		expect(evaluator.stringConvert("")).toBe("");
		expect(evaluator.stringConvert("abc")).toBe("abc");

		expect(evaluator.stringConvert(-1.0)).toBe("-1");
		expect(evaluator.stringConvert(0.0)).toBe("0");
		expect(evaluator.stringConvert(1.0)).toBe("1");
		expect(evaluator.stringConvert(2.0)).toBe("2");
		expect(evaluator.stringConvert(3.0)).toBe("3");
		expect(evaluator.stringConvert(2147483647.0)).toBe("2147483647");
		expect(evaluator.stringConvert(-2147483647.0)).toBe("-2147483647");
		expect(evaluator.stringConvert(9007199254740991)).toBe("9007199254740991");
		expect(evaluator.stringConvert(-9007199254740991)).toBe("-9007199254740991");
		expect(evaluator.stringConvert(0.9007199254740991)).toBe("0.900719925474099");
		expect(evaluator.stringConvert(-0.9007199254740991)).toBe("-0.900719925474099");
		expect(evaluator.stringConvert(-1)).toBe("-1");
		expect(evaluator.stringConvert(0)).toBe("0");
		expect(evaluator.stringConvert(1)).toBe("1");
		expect(evaluator.stringConvert(2)).toBe("2");
		expect(evaluator.stringConvert(3)).toBe("3");
		expect(evaluator.stringConvert(2147483647)).toBe("2147483647");
		expect(evaluator.stringConvert(-2147483647)).toBe("-2147483647");
		expect(evaluator.stringConvert(9007199254740991)).toBe("9007199254740991");
		expect(evaluator.stringConvert(-9007199254740991)).toBe("-9007199254740991");
	});

	describe("extractVar()", () => {
		it("should find data by paths delimited by /", () => {
			const vars = {
				a: 1,
				b: true,
				c: false,
				d: [1, 2, 3],
				e: [1, { z: 2 }, 3],
				f: { y: { x: 3, 0: 10 } },
			};

			const evaluator = new Evaluator({}, vars);

			expect(evaluator.extractVar("a")).toBe(1);
			expect(evaluator.extractVar("b")).toBe(true);
			expect(evaluator.extractVar("c")).toBe(false);
			expect(evaluator.extractVar("d")).toEqual([1, 2, 3]);
			expect(evaluator.extractVar("e")).toEqual([1, { z: 2 }, 3]);
			expect(evaluator.extractVar("f")).toEqual({ y: { x: 3, 0: 10 } });

			expect(evaluator.extractVar("a/0")).toBe(null);
			expect(evaluator.extractVar("a/b")).toBe(null);
			expect(evaluator.extractVar("b/0")).toBe(null);
			expect(evaluator.extractVar("b/e")).toBe(null);

			expect(evaluator.extractVar("d/0")).toBe(1);
			expect(evaluator.extractVar("d/1")).toBe(2);
			expect(evaluator.extractVar("d/2")).toBe(3);
			expect(evaluator.extractVar("d/3")).toBe(null);

			expect(evaluator.extractVar("e/0")).toBe(1);
			expect(evaluator.extractVar("e/1/z")).toBe(2);
			expect(evaluator.extractVar("e/2")).toBe(3);
			expect(evaluator.extractVar("e/1/0")).toBe(null);

			expect(evaluator.extractVar("f/y")).toMatchObject({ x: 3 });
			expect(evaluator.extractVar("f/y/x")).toBe(3);
			expect(evaluator.extractVar("f/y/0")).toBe(10);
		});
	});

	describe("compare()", () => {
		it("should return null if comparing non-null with null", () => {
			const evaluator = new Evaluator({}, {});

			expect(evaluator.compare(null, null)).toBe(0);

			expect(evaluator.compare(null, 0)).toBe(null);
			expect(evaluator.compare(null, 1)).toBe(null);
			expect(evaluator.compare(null, true)).toBe(null);
			expect(evaluator.compare(null, false)).toBe(null);
			expect(evaluator.compare(null, "")).toBe(null);
			expect(evaluator.compare(null, "abc")).toBe(null);
			expect(evaluator.compare(null, {})).toBe(null);
			expect(evaluator.compare(null, [])).toBe(null);

			expect(evaluator.compare(0, null)).toBe(null);
			expect(evaluator.compare(1, null)).toBe(null);
			expect(evaluator.compare(true, null)).toBe(null);
			expect(evaluator.compare(false, null)).toBe(null);
			expect(evaluator.compare("", null)).toBe(null);
			expect(evaluator.compare("abc", null)).toBe(null);
			expect(evaluator.compare({}, null)).toBe(null);
			expect(evaluator.compare([], null)).toBe(null);
		});

		it("should return null if comparing non-object with object", () => {
			const evaluator = new Evaluator({}, {});

			expect(evaluator.compare({}, 0)).toBe(null);
			expect(evaluator.compare({}, 1)).toBe(null);
			expect(evaluator.compare({}, true)).toBe(null);
			expect(evaluator.compare({}, false)).toBe(null);
			expect(evaluator.compare({}, "")).toBe(null);
			expect(evaluator.compare({}, "abc")).toBe(null);
			expect(evaluator.compare({}, {})).toBe(0);
			expect(evaluator.compare({ a: 1 }, { a: 1 })).toBe(0);
			expect(evaluator.compare({ a: 1 }, { b: 2 })).toBe(null);
			expect(evaluator.compare({}, [])).toBe(null);

			expect(evaluator.compare([], 0)).toBe(null);
			expect(evaluator.compare([], 1)).toBe(null);
			expect(evaluator.compare([], true)).toBe(null);
			expect(evaluator.compare([], false)).toBe(null);
			expect(evaluator.compare([], "")).toBe(null);
			expect(evaluator.compare([], "abc")).toBe(null);
			expect(evaluator.compare([], {})).toBe(null);
			expect(evaluator.compare([], [])).toBe(0);
			expect(evaluator.compare([1, 2], [1, 2])).toBe(0);
			expect(evaluator.compare([1, 2], [3, 4])).toBe(null);
		});

		it("should coerce right-side argument to boolean and compare", () => {
			const evaluator = new Evaluator({}, {});

			expect(evaluator.compare(false, 0)).toBe(0);
			expect(evaluator.compare(false, 1)).toBe(-1);
			expect(evaluator.compare(false, true)).toBe(-1);
			expect(evaluator.compare(false, false)).toBe(0);
			expect(evaluator.compare(false, "")).toBe(0);
			expect(evaluator.compare(false, "abc")).toBe(-1);
			expect(evaluator.compare(false, {})).toBe(-1);
			expect(evaluator.compare(false, [])).toBe(-1);

			expect(evaluator.compare(true, 0)).toBe(1);
			expect(evaluator.compare(true, 1)).toBe(0);
			expect(evaluator.compare(true, true)).toBe(0);
			expect(evaluator.compare(true, false)).toBe(1);
			expect(evaluator.compare(true, "")).toBe(1);
			expect(evaluator.compare(true, "abc")).toBe(0);
			expect(evaluator.compare(true, {})).toBe(0);
			expect(evaluator.compare(true, [])).toBe(0);
		});

		it("should coerce right-side argument to boolean and compare", () => {
			const evaluator = new Evaluator({}, {});

			expect(evaluator.compare(0, 0)).toBe(0);
			expect(evaluator.compare(0, 1)).toBe(-1);
			expect(evaluator.compare(0, true)).toBe(-1);
			expect(evaluator.compare(0, false)).toBe(0);
			expect(evaluator.compare(0, "")).toBe(null);
			expect(evaluator.compare(0, "abc")).toBe(null);
			expect(evaluator.compare(0, {})).toBe(null);
			expect(evaluator.compare(0, [])).toBe(null);

			expect(evaluator.compare(1, 0)).toBe(1);
			expect(evaluator.compare(1, 1)).toBe(0);
			expect(evaluator.compare(1, true)).toBe(0);
			expect(evaluator.compare(1, false)).toBe(1);
			expect(evaluator.compare(1, "")).toBe(null);
			expect(evaluator.compare(1, "abc")).toBe(null);
			expect(evaluator.compare(1, {})).toBe(null);
			expect(evaluator.compare(1, [])).toBe(null);

			expect(evaluator.compare(1.0, 1)).toBe(0);
			expect(evaluator.compare(1.5, 1)).toBe(1);
			expect(evaluator.compare(2.0, 1)).toBe(1);
			expect(evaluator.compare(3.0, 1)).toBe(1);

			expect(evaluator.compare(1, 1.0)).toBe(0);
			expect(evaluator.compare(1, 1.5)).toBe(-1);
			expect(evaluator.compare(1, 2.0)).toBe(-1);
			expect(evaluator.compare(1, 3.0)).toBe(-1);

			expect(evaluator.compare(9007199254740991, 9007199254740991)).toBe(0);
			expect(evaluator.compare(0, 9007199254740991)).toBe(-1);
			expect(evaluator.compare(9007199254740991, 0)).toBe(1);

			expect(evaluator.compare(9007199254740991.0, 9007199254740991.0)).toBe(0);
			expect(evaluator.compare(0, 9007199254740991.0)).toBe(-1);
			expect(evaluator.compare(9007199254740991.0, 0)).toBe(1);
		});

		it("should coerce right-hand side argument to string and compare", () => {
			const evaluator = new Evaluator({}, {});

			expect(evaluator.compare("", "")).toBe(0);
			expect(evaluator.compare("abc", "abc")).toBe(0);
			expect(evaluator.compare("0", 0)).toBe(0);
			expect(evaluator.compare("1", 1)).toBe(0);
			expect(evaluator.compare("true", true)).toBe(0);
			expect(evaluator.compare("false", false)).toBe(0);
			expect(evaluator.compare("", {})).toBe(null);
			expect(evaluator.compare("abc", {})).toBe(null);
			expect(evaluator.compare("", [])).toBe(null);
			expect(evaluator.compare("abc", [])).toBe(null);

			expect(evaluator.compare("abc", "bcd")).toBe(-1);
			expect(evaluator.compare("bcd", "abc")).toBe(1);
			expect(evaluator.compare("0", "1")).toBe(-1);
			expect(evaluator.compare("1", "0")).toBe(1);
			expect(evaluator.compare("9", "100")).toBe(1);
			expect(evaluator.compare("100", "9")).toBe(-1);
		});
	});
});
