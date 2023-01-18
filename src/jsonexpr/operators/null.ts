import { Evaluator } from "../evaluator";
import { UnaryOperator } from "./unary";

export class NullOperator extends UnaryOperator {
	unary(_: Evaluator, value: unknown) {
		return value === null;
	}
}
