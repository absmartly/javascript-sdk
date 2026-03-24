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
import { SemverEqualsOperator } from "./operators/semver_eq";
import { SemverGreaterThanOperator } from "./operators/semver_gt";
import { SemverGreaterThanOrEqualOperator } from "./operators/semver_gte";
import { SemverLessThanOperator } from "./operators/semver_lt";
import { SemverLessThanOrEqualOperator } from "./operators/semver_lte";

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
	evaluateBooleanExpr<TData>(expr: TData[] | Record<string, TData>, vars: Record<string, TData>) {
		const evaluator = new Evaluator(operators, vars);
		return evaluator.booleanConvert(evaluator.evaluate(expr));
	}

	evaluateExpr<TData>(expr: TData[] | Record<string, TData>, vars: Record<string, TData>) {
		const evaluator = new Evaluator(operators, vars);
		return evaluator.evaluate(expr);
	}
}
