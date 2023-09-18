import { Evaluator } from "../evaluator";
import { UnaryOperator } from "./unary";

export class NotOperator extends UnaryOperator {
	unary(evaluator: Evaluator, arg: string | number | boolean) {
		return !evaluator.booleanConvert(arg);
	}
}
