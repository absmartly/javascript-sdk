import { Evaluator } from "../evaluator";
import { UnaryOperator } from "./unary";

export class NotOperator extends UnaryOperator {
	unary(evaluator: Evaluator, arg: any) {
		return !evaluator.booleanConvert(arg);
	}
}
