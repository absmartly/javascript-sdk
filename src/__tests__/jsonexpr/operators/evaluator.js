import { isEqualsDeep, isObject } from "../../../utils";

export function mockEvaluator() {
	return {
		evaluate: jest.fn((expr) => {
			return expr;
		}),

		booleanConvert: jest.fn((expr) => {
			return expr;
		}),

		numberConvert: jest.fn((expr) => {
			return expr;
		}),

		stringConvert: jest.fn((expr) => {
			return expr;
		}),

		versionCompare: jest.fn((lhs, rhs) => {
			const lhsStr = typeof lhs === "string" ? lhs : null;
			const rhsStr = typeof rhs === "string" ? rhs : null;
			if (lhsStr === null || rhsStr === null) return null;
			const lParts = lhsStr.split(".").map(Number);
			const rParts = rhsStr.split(".").map(Number);
			const len = Math.max(lParts.length, rParts.length);
			for (let i = 0; i < len; i++) {
				const l = lParts[i] || 0;
				const r = rParts[i] || 0;
				if (l !== r) return l > r ? 1 : -1;
			}
			return 0;
		}),

		compare: jest.fn((lhs, rhs) => {
			switch (typeof lhs) {
				case "boolean":
				case "number":
				case "string":
					return lhs === rhs ? 0 : lhs > rhs ? 1 : -1;
				default:
					if (isObject(lhs) || Array.isArray(lhs)) {
						if (isEqualsDeep(lhs, rhs)) {
							return 0;
						}
					}
					break;
			}
			return null;
		}),

		extractVar: jest.fn((path) => {
			switch (path) {
				case "a/b/c":
					return "abc";
				default:
					return null;
			}
		}),
	};
}
