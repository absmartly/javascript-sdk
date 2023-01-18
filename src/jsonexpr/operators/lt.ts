import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";

export class LessThanOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown) {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result < 0 : null;
	}
}
