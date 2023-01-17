import { Evaluator } from "../evaluator";

export abstract class UnaryOperator {
	abstract unary(evaluator: Evaluator, arg: any): boolean;
	evaluate(evaluator: Evaluator, arg: any) {
		arg = evaluator.evaluate(arg);
		return this.unary(evaluator, arg);
	}
}
