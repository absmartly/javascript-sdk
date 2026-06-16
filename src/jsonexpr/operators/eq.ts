import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";

export class EqualsOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown) {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result === 0 : null;
	}
}
