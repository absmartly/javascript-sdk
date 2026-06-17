import safeRegex from "safe-regex2";

import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";

const MAX_PATTERN_LENGTH = 1000;
const MAX_TEXT_LENGTH = 10000;
const MAX_REGEX_CACHE_SIZE = 100;

const regexCache = new Map<string, RegExp>();

function getOrCompileRegex(pattern: string): RegExp {
	let compiled = regexCache.get(pattern);
	if (compiled !== undefined) {
		return compiled;
	}
	compiled = new RegExp(pattern);
	if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
		const firstKey = regexCache.keys().next().value;
		if (firstKey !== undefined) {
			regexCache.delete(firstKey);
		}
	}
	regexCache.set(pattern, compiled);
	return compiled;
}

export class MatchOperator extends BinaryOperator {
	binary(evaluator: Evaluator, text: string | null, pattern: string | null) {
		text = evaluator.stringConvert(text);
		if (text !== null) {
			pattern = evaluator.stringConvert(pattern);
			if (pattern !== null) {
				if (pattern.length > MAX_PATTERN_LENGTH) {
					return null;
				}
				if (text.length > MAX_TEXT_LENGTH) {
					return null;
				}
				// Reject patterns vulnerable to catastrophic backtracking (ReDoS).
				// Length caps alone do not prevent attacks like (a+)+ or (a|a)+.
				if (!safeRegex(pattern)) {
					return null;
				}
				try {
					const compiled = getOrCompileRegex(pattern);
					return compiled.test(text);
				} catch (error) {
					return null;
				}
			}
		}
		return null;
	}
}
