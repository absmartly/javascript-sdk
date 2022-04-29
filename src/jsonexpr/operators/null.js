import { UnaryOperator } from "./unary";

export class NullOperator extends UnaryOperator {
	unary(evaluator, value) {
		return value === null;
	}
}
