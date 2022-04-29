export class AndCombinator {
	evaluate(evaluator, args) {
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
