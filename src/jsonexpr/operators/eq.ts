import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";

export class EqualsOperator extends BinaryOperator {
	evaluate(evaluator: Evaluator, args: unknown[]) {
		const lhs = args.length > 0 ? evaluator.evaluate(args[0]) : null;
		const rhs = args.length > 1 ? evaluator.evaluate(args[1]) : null;
		return this.binary(evaluator, lhs, rhs);
	}

	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown) {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result === 0 : null;
	}
}
