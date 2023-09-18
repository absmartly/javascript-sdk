import { Evaluator } from "../evaluator";

export abstract class UnaryOperator {
	abstract unary(evaluator: Evaluator, arg: unknown[] | Record<string, unknown> | string | number | boolean): boolean;
	evaluate(evaluator: Evaluator, arg: unknown[] | Record<string, unknown> | string | number | boolean) {
		arg = evaluator.evaluate(arg);
		return this.unary(evaluator, arg);
	}
}
