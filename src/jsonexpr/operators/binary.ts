import { Evaluator } from "../evaluator";

export abstract class BinaryOperator {
	abstract binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null;

	evaluate(evaluator: Evaluator, args: unknown[]) {
		if (Array.isArray(args)) {
			const lhs = args.length > 0 ? evaluator.evaluate(args[0]) : null;
			if (lhs !== null) {
				const rhs = args.length > 1 ? evaluator.evaluate(args[1]) : null;
				if (rhs !== null) {
					return this.binary(evaluator, lhs, rhs);
				}
			}
		}
		return null;
	}
}
