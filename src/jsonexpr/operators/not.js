import { UnaryOperator } from "./unary";

export class NotOperator extends UnaryOperator {
	unary(evaluator, arg) {
		return !evaluator.booleanConvert(arg);
	}
}
