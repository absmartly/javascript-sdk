import { ValueOperator } from "./operators/value";
import { AndCombinator } from "./operators/and";
import { OrCombinator } from "./operators/or";
import { VarOperator } from "./operators/var";
import { NotOperator } from "./operators/not";
import { NullOperator } from "./operators/null";
import { MatchOperator } from "./operators/match";
import { InOperator } from "./operators/in";
import { Evaluator } from "./evaluator";
import { EqualsOperator } from "./operators/eq";
import { GreaterThanOperator } from "./operators/gt";
import { GreaterThanOrEqualOperator } from "./operators/gte";
import { LessThanOperator } from "./operators/lt";
import { LessThanOrEqualOperator } from "./operators/lte";

const operators = {
	and: new AndCombinator(),
	or: new OrCombinator(),
	value: new ValueOperator(),
	var: new VarOperator(),
	null: new NullOperator(),
	not: new NotOperator(),
	in: new InOperator(),
	match: new MatchOperator(),
	eq: new EqualsOperator(),
	gt: new GreaterThanOperator(),
	gte: new GreaterThanOrEqualOperator(),
	lt: new LessThanOperator(),
	lte: new LessThanOrEqualOperator(),
};

export class JsonExpr {
	evaluateBooleanExpr(expr: any[] | Record<string, unknown>, vars: Record<string, unknown>) {
		const evaluator = new Evaluator(operators, vars);
		return evaluator.booleanConvert(evaluator.evaluate(expr));
	}

	evaluateExpr(expr: any[] | Record<string, unknown>, vars: Record<string, unknown>) {
		const evaluator = new Evaluator(operators, vars);
		return evaluator.evaluate(expr);
	}
}
