import { Evaluator } from "./evaluator";
import { isObject } from "../utils";

export class ValueOperator {
	evaluate(_: Evaluator, value: unknown): unknown {
		return value;
	}
}

export class VarOperator {
	evaluate(evaluator: Evaluator, path: unknown): unknown {
		if (isObject(path)) {
			path = (path as { path: string }).path;
		}
		return typeof path === "string" ? evaluator.extractVar(path) : null;
	}
}

export class AndCombinator {
	evaluate(evaluator: Evaluator, args: unknown): boolean | null {
		if (Array.isArray(args)) {
			for (const expr of args) {
				if (!evaluator.booleanConvert(evaluator.evaluate(expr))) return false;
			}
			return true;
		}
		return null;
	}
}

export class OrCombinator {
	evaluate(evaluator: Evaluator, args: unknown): boolean | null {
		if (Array.isArray(args)) {
			for (const expr of args) {
				if (evaluator.booleanConvert(evaluator.evaluate(expr))) return true;
			}
			return args.length === 0;
		}
		return null;
	}
}

abstract class UnaryOperator {
	abstract unary(evaluator: Evaluator, arg: unknown): boolean;
	evaluate(evaluator: Evaluator, arg: unknown): boolean {
		arg = evaluator.evaluate(arg);
		return this.unary(evaluator, arg);
	}
}

export class NotOperator extends UnaryOperator {
	unary(evaluator: Evaluator, arg: unknown): boolean {
		return !evaluator.booleanConvert(arg);
	}
}

export class NullOperator extends UnaryOperator {
	unary(_: Evaluator, value: unknown): boolean {
		return value === null;
	}
}

abstract class BinaryOperator {
	abstract binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null;
	evaluate(evaluator: Evaluator, args: unknown): boolean | null {
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

export class EqualsOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result === 0 : null;
	}
}

export class GreaterThanOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result > 0 : null;
	}
}

export class GreaterThanOrEqualOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result >= 0 : null;
	}
}

export class LessThanOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result < 0 : null;
	}
}

export class LessThanOrEqualOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.compare(lhs, rhs);
		return result !== null ? result <= 0 : null;
	}
}

export class InOperator extends BinaryOperator {
	binary(evaluator: Evaluator, haystack: unknown, needle: unknown): boolean | null {
		if (Array.isArray(haystack)) {
			for (const item of haystack) {
				if (evaluator.compare(item, needle) === 0) return true;
			}
			return false;
		} else if (typeof haystack === "string") {
			const needleString = evaluator.stringConvert(needle);
			return needleString !== null && haystack.includes(needleString);
		} else if (isObject(haystack)) {
			const needleString = evaluator.stringConvert(needle);
			return needleString != null && Object.prototype.hasOwnProperty.call(haystack, needleString);
		}
		return null;
	}
}

export class MatchOperator extends BinaryOperator {
	binary(evaluator: Evaluator, text: unknown, pattern: unknown): boolean | null {
		const textStr = evaluator.stringConvert(text);
		if (textStr !== null) {
			const patternStr = evaluator.stringConvert(pattern);
			if (patternStr !== null) {
				try {
					return new RegExp(patternStr).test(textStr);
				} catch {
					return null;
				}
			}
		}
		return null;
	}
}

export class SemverEqualsOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.versionCompare(lhs, rhs);
		return result !== null ? result === 0 : null;
	}
}

export class SemverGreaterThanOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.versionCompare(lhs, rhs);
		return result !== null ? result > 0 : null;
	}
}

export class SemverGreaterThanOrEqualOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.versionCompare(lhs, rhs);
		return result !== null ? result >= 0 : null;
	}
}

export class SemverLessThanOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.versionCompare(lhs, rhs);
		return result !== null ? result < 0 : null;
	}
}

export class SemverLessThanOrEqualOperator extends BinaryOperator {
	binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
		const result = evaluator.versionCompare(lhs, rhs);
		return result !== null ? result <= 0 : null;
	}
}
