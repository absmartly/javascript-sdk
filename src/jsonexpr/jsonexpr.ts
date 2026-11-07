import { Evaluator } from "./evaluator";
import {
	AndCombinator,
	EqualsOperator,
	GreaterThanOperator,
	GreaterThanOrEqualOperator,
	InOperator,
	LessThanOperator,
	LessThanOrEqualOperator,
	MatchOperator,
	NotOperator,
	NullOperator,
	OrCombinator,
	SemverEqualsOperator,
	SemverGreaterThanOperator,
	SemverGreaterThanOrEqualOperator,
	SemverLessThanOperator,
	SemverLessThanOrEqualOperator,
	ValueOperator,
	VarOperator,
} from "./operators";

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
	semver_eq: new SemverEqualsOperator(),
	semver_gt: new SemverGreaterThanOperator(),
	semver_gte: new SemverGreaterThanOrEqualOperator(),
	semver_lt: new SemverLessThanOperator(),
	semver_lte: new SemverLessThanOrEqualOperator(),
};

export class JsonExpr {
	evaluateBooleanExpr(expr: unknown, vars: Record<string, unknown>): boolean {
		const evaluator = new Evaluator(operators, vars);
		return evaluator.booleanConvert(evaluator.evaluate(expr));
	}

	evaluateExpr(expr: unknown, vars: Record<string, unknown>): unknown {
		const evaluator = new Evaluator(operators, vars);
		return evaluator.evaluate(expr);
	}
}
