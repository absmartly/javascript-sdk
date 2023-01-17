import { Evaluator } from "../evaluator";
import { UnaryOperator } from "./unary";

export class NullOperator extends UnaryOperator {
	unary(_: Evaluator, value: any) {
		return value === null;
	}
}
