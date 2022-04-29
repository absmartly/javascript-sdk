import { BinaryOperator } from "./binary";

export class EqualsOperator extends BinaryOperator {
	binary(evaluator, lhs, rhs) {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result === 0 : null;
	}
}
