import { mergeConfig } from "../config";
import Context from "../context";

jest.mock("../context");

describe("Config", () => {
	it("mergeConfig() should create getters that call treatment", (done) => {
		const context = new Context();

		const mockConfig = [
			{
				key: "d",
				value: 5,
			},
			{
				key: "e",
				value: 5,
			},
		];

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

		expect(actual.d).toEqual(mockConfig.filter((x) => x.key === "d")[0].value);
		expect(context.treatment).toHaveBeenCalledTimes(1);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		expect(actual.e).toEqual(mockConfig.filter((x) => x.key === "e")[0].value);
		expect(context.treatment).toHaveBeenCalledTimes(1);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");

		done();
	});

	it("mergeConfig() should merge dotted keys", (done) => {
		const context = new Context();

		const mockConfig = [
			{
				key: "c.d",
				value: 5,
			},
			{
				key: "e.f",
				value: 5,
			},
		];

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

		expect(actual.c.d).toEqual(mockConfig.filter((x) => x.key === "c.d")[0].value);
		expect(context.treatment).toHaveBeenCalledTimes(1);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		expect(actual.e.f).toEqual(mockConfig.filter((x) => x.key === "e.f")[0].value);
		expect(context.treatment).toHaveBeenCalledTimes(1);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		done();
	});

	it("mergeConfig() should warn about mismatching object merges", (done) => {
		jest.spyOn(console, "warn").mockImplementation(() => {});

		const context = new Context();

		const mockConfig = [
			{
				key: "b.c.d",
				value: 5,
			},
			{
				key: "c.d",
				value: 5,
			},
			{
				key: "d.e",
				value: 5,
			},
		];

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
		};

		const actual = mergeConfig(context, previousConfig);
		expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
		expect(actual).toStrictEqual(expected);
		context.treatment.mockClear();

		expect(actual.b.c.d).toEqual(mockConfig.filter((x) => x.key === "b.c.d")[0].value);
		expect(context.treatment).toHaveBeenCalledTimes(1);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		expect(actual.c.d).toEqual(mockConfig.filter((x) => x.key === "c.d")[0].value);
		expect(context.treatment).toHaveBeenCalledTimes(1);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		expect(actual.d.e).toEqual(mockConfig.filter((x) => x.key === "d.e")[0].value);
		expect(context.treatment).toHaveBeenCalledTimes(1);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		expect(console.warn).toHaveBeenCalledTimes(3);
		expect(console.warn).toHaveBeenCalledWith(
			"Config key 'b.c.d' for experiment 'exp_test' is overriding non-object value at 'b.c' with an object."
		);
		expect(console.warn).toHaveBeenCalledWith(
			"Config key 'c.d' for experiment 'exp_test' is overriding non-object value at 'c' with an object."
		);
		expect(console.warn).toHaveBeenCalledWith(
			"Config key 'd.e' for experiment 'exp_test' is overriding object with non-object value."
		);

		done();
	});

	it("mergeConfig() should format values", (done) => {
		jest.spyOn(console, "warn").mockImplementation(() => {});

		const context = new Context();

		const mockConfig = [
			{
				key: "json",
				value: '{"key":"test","value":5}',
				format: "json",
			},
			{
				key: "string",
				value: "test",
			},
			{
				key: "number",
				value: "5",
				format: "number",
			},
		];

		context.experiments.mockReturnValue(["exp_test"]);
		context.experimentConfig.mockReturnValue(mockConfig);

		const previousConfig = {
			a: 1,
			b: 2,
			c: 3,
		};

		const expected = {
			a: 1,
			b: 2,
			c: 3,
			// json: {
			// 	key: "test",
			// 	value: 5
			// },
			// string: "test",
			// number: "5",
		};

		const actual = mergeConfig(context, previousConfig);
		expect(actual).not.toBe(previousConfig); // should be a clone and new properties are not values, but have accessors
		expect(actual).toStrictEqual(expected);
		context.treatment.mockClear();

		expect(actual.json).toEqual(JSON.parse(mockConfig.filter((x) => x.key === "json")[0].value));
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		expect(actual.string).toStrictEqual(mockConfig.filter((x) => x.key === "string")[0].value);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		expect(actual.number).toStrictEqual(mockConfig.filter((x) => x.key === "number")[0].value);
		expect(context.treatment).toHaveBeenCalledWith("exp_test");
		context.treatment.mockClear();

		expect(console.warn).toHaveBeenCalledTimes(1);

		done();
	});
});
