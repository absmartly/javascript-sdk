import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";

export class MatchOperator extends BinaryOperator {
	binary(evaluator: Evaluator, text: any, pattern: any) {
		text = evaluator.stringConvert(text);
		if (text !== null) {
			pattern = evaluator.stringConvert(pattern);
			if (pattern !== null) {
				try {
					const compiled = new RegExp(pattern);
					return compiled.test(text);
				} catch (ignored) {
					return null;
				}
			}
		}
		return null;
	}
}
