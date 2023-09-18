import { Evaluator } from "../evaluator";

export class OrCombinator {
	evaluate(evaluator: Evaluator, args: unknown) {
		if (Array.isArray(args)) {
			for (const expr of args) {
				if (evaluator.booleanConvert(evaluator.evaluate(expr))) {
					return true;
				}
			}
			return args.length === 0;
		}
		return null;
	}
}
