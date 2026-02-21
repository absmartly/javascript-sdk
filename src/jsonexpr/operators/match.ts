import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";

const MAX_PATTERN_LENGTH = 1000;
const MAX_TEXT_LENGTH = 10000;

export class MatchOperator extends BinaryOperator {
	binary(evaluator: Evaluator, text: string | null, pattern: string | null) {
		text = evaluator.stringConvert(text);
		if (text !== null) {
			pattern = evaluator.stringConvert(pattern);
			if (pattern !== null) {
				if (pattern.length > MAX_PATTERN_LENGTH) {
					console.error(`Regex pattern too long: ${pattern.length} > ${MAX_PATTERN_LENGTH}`);
					return null;
				}
				if (text.length > MAX_TEXT_LENGTH) {
					console.error(`Text too long for regex matching: ${text.length} > ${MAX_TEXT_LENGTH}`);
					return null;
				}
				try {
					const compiled = new RegExp(pattern);
					return compiled.test(text);
				} catch (error) {
					console.error(`Invalid regex pattern: ${pattern}`, error);
					return null;
				}
			}
		}
		return null;
	}
}
