import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";

export class SemverLessThanOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown) {
		const result = evaluator.versionCompare(lhs, rhs);
		return result !== null ? result < 0 : null;
	}
}
