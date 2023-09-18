import { Evaluator } from "../evaluator";

export class AndCombinator {
	evaluate(evaluator: Evaluator, args: unknown[]): boolean | null {
		if (Array.isArray(args)) {
			for (const expr of args) {
				if (!evaluator.booleanConvert(evaluator.evaluate(expr))) {
					return false;
				}
			}
			return true;
		}
		return null;
	}
}
