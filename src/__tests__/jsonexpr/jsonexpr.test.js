import { JsonExpr } from "../../jsonexpr/jsonexpr";

describe("jsonexpr", () => {
	const valueFor = (x) => ({ value: x });
	const varFor = (p) => ({ var: { path: p } });
	const unaryOp = (op, arg) => ({ [op]: arg });
	const binaryOp = (op, arg0, arg1) => ({ [op]: [arg0, arg1] });

	const jsonExpr = new JsonExpr();

	const John = { age: 20, language: "en-US", returning: false };
	const Terry = { age: 20, language: "en-GB", returning: true };
	const Kate = { age: 50, language: "es-ES", returning: false };
	const Maria = { age: 52, language: "pt-PT", returning: true };

	const AgeTwentyAndUS = [
		binaryOp("eq", varFor("age"), valueFor(20)),
		binaryOp("eq", varFor("language"), valueFor("en-US")),
	];
	const AgeOverFifty = [binaryOp("gte", varFor("age"), valueFor(50))];
	const AgeTwentyAndUS_Or_AgeOverFifty = [{ or: [AgeTwentyAndUS, AgeOverFifty] }];
	const Returning = [binaryOp("eq", varFor("returning"), valueFor(true))];
	const Returning_And_AgeTwentyAndUS_Or_AgeOverFifty = [Returning, AgeTwentyAndUS_Or_AgeOverFifty];
	const NotReturning_And_Spanish = [unaryOp("not", Returning), binaryOp("eq", varFor("language"), valueFor("es-ES"))];

	describe("evaluateBooleanExpr()", () => {
		test("AgeTwentyAndUS", () => {
			expect(jsonExpr.evaluateBooleanExpr(AgeTwentyAndUS, John)).toEqual(true);
			expect(jsonExpr.evaluateBooleanExpr(AgeTwentyAndUS, Terry)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(AgeTwentyAndUS, Kate)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(AgeTwentyAndUS, Maria)).toEqual(false);
		});

		test("AgeOverFifty", () => {
			expect(jsonExpr.evaluateBooleanExpr(AgeOverFifty, John)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(AgeOverFifty, Terry)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(AgeOverFifty, Kate)).toEqual(true);
			expect(jsonExpr.evaluateBooleanExpr(AgeOverFifty, Maria)).toEqual(true);
		});

		test("AgeTwentyAndUS_Or_AgeOverFifty", () => {
			expect(jsonExpr.evaluateBooleanExpr(AgeTwentyAndUS_Or_AgeOverFifty, John)).toEqual(true);
			expect(jsonExpr.evaluateBooleanExpr(AgeTwentyAndUS_Or_AgeOverFifty, Terry)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(AgeTwentyAndUS_Or_AgeOverFifty, Kate)).toEqual(true);
			expect(jsonExpr.evaluateBooleanExpr(AgeTwentyAndUS_Or_AgeOverFifty, Maria)).toEqual(true);
		});

		test("Returning", () => {
			expect(jsonExpr.evaluateBooleanExpr(Returning, John)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(Returning, Terry)).toEqual(true);
			expect(jsonExpr.evaluateBooleanExpr(Returning, Kate)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(Returning, Maria)).toEqual(true);
		});

		test("Returning_And_AgeTwentyAndUS_Or_AgeOverFifty", () => {
			expect(jsonExpr.evaluateBooleanExpr(Returning_And_AgeTwentyAndUS_Or_AgeOverFifty, John)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(Returning_And_AgeTwentyAndUS_Or_AgeOverFifty, Terry)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(Returning_And_AgeTwentyAndUS_Or_AgeOverFifty, Kate)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(Returning_And_AgeTwentyAndUS_Or_AgeOverFifty, Maria)).toEqual(true);
		});

		test("NotReturning_And_Spanish", () => {
			expect(jsonExpr.evaluateBooleanExpr(NotReturning_And_Spanish, John)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(NotReturning_And_Spanish, Terry)).toEqual(false);
			expect(jsonExpr.evaluateBooleanExpr(NotReturning_And_Spanish, Kate)).toEqual(true);
			expect(jsonExpr.evaluateBooleanExpr(NotReturning_And_Spanish, Maria)).toEqual(false);
		});
	});
});
