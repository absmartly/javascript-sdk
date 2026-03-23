/* eslint-disable */
import { isEqualsDeep, isObject } from "../utils";

export class Evaluator {
	private readonly operators: any;
	private readonly vars: any;

	constructor(operators: any, vars: any) {
		this.operators = operators;
		this.vars = vars;
	}

	evaluate<TExpr>(expr: TExpr) {
		if (Array.isArray(expr)) {
			return this.operators["and"].evaluate(this, expr);
		} else if (isObject(expr)) {
			for (const [key, value] of Object.entries(expr)) {
				const op = this.operators[key];
				if (op !== undefined) {
					return op.evaluate(this, value);
				}
				break;
			}
		}

		return null;
	}

	booleanConvert<TData>(x: TData) {
		const type = typeof x;
		switch (type) {
			case "boolean":
				return x;
			case "number":
				return x !== 0;
			case "string":
				return x !== "false" && x !== "0" && x !== "";
			default:
				return x !== null && x !== undefined;
		}
	}

	numberConvert<TData>(x: TData) {
		switch (typeof x) {
			case "number":
				return x;
			case "boolean":
				return x ? 1 : 0;
			case "string": {
				const y = parseFloat(x);
				return Number.isFinite(y) ? y : null;
			}
			default:
				return null;
		}
	}

	stringConvert<TData>(x: TData) {
		switch (typeof x) {
			case "string":
				return x;
			case "boolean":
				return x.toString();
			case "number":
				return x.toFixed(15).replace(/\.?0{0,15}$/, "");
			default:
				return null;
		}
	}

	extractVar(path: string) {
		const frags = path.split("/");

		let target = this.vars ?? {};
		for (let index = 0; index < frags.length; ++index) {
			const frag = frags[index];

			const value = target[frag];
			if (value !== undefined) {
				target = value;
				continue;
			}

			return null;
		}

		return target;
	}

	versionCompare<TData>(lhs: TData, rhs: TData) {
		const lhsStr = this.stringConvert(lhs);
		const rhsStr = this.stringConvert(rhs);
		if (lhsStr === null || rhsStr === null) {
			return null;
		}

		const parseSemver = (version: string) => {
			let v = version;
			if (v.startsWith("v") || v.startsWith("V")) {
				v = v.substring(1);
			}

			const plusIndex = v.indexOf("+");
			if (plusIndex >= 0) {
				v = v.substring(0, plusIndex);
			}

			const [core, ...preReleaseParts] = v.split("-");
			const preRelease = preReleaseParts.join("-");
			const parts = core.split(".");

			return { parts, preRelease };
		};

		const compareIdentifiers = (a: string, b: string) => {
			const aNum = parseInt(a, 10);
			const bNum = parseInt(b, 10);
			const aIsNum = !isNaN(aNum) && String(aNum) === a;
			const bIsNum = !isNaN(bNum) && String(bNum) === b;

			if (aIsNum && bIsNum) {
				return aNum === bNum ? 0 : aNum > bNum ? 1 : -1;
			}
			if (aIsNum) return -1;
			if (bIsNum) return 1;
			return a === b ? 0 : a > b ? 1 : -1;
		};

		const l = parseSemver(lhsStr);
		const r = parseSemver(rhsStr);

		const maxLen = Math.max(l.parts.length, r.parts.length);
		for (let i = 0; i < maxLen; i++) {
			const lPart = l.parts[i] || "0";
			const rPart = r.parts[i] || "0";
			const result = compareIdentifiers(lPart, rPart);
			if (result !== 0) return result;
		}

		if (!l.preRelease && !r.preRelease) return 0;
		if (!l.preRelease) return 1;
		if (!r.preRelease) return -1;

		const lPreParts = l.preRelease.split(".");
		const rPreParts = r.preRelease.split(".");
		const preLen = Math.max(lPreParts.length, rPreParts.length);
		for (let i = 0; i < preLen; i++) {
			if (i >= lPreParts.length) return -1;
			if (i >= rPreParts.length) return 1;
			const result = compareIdentifiers(lPreParts[i], rPreParts[i]);
			if (result !== 0) return result;
		}

		return 0;
	}

	compare<TData>(lhs: TData, rhs: TData) {
		if (lhs === null) {
			return rhs === null ? 0 : null;
		} else if (rhs === null) {
			return null;
		}

		switch (typeof lhs) {
			case "number": {
				const rvalue = this.numberConvert(rhs);
				if (rvalue !== null) {
					return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
				}
				break;
			}
			case "string": {
				const rvalue = this.stringConvert(rhs);
				if (rvalue !== null) {
					return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
				}
				break;
			}
			case "boolean": {
				const rvalue = this.booleanConvert(rhs);
				if (rvalue != null) {
					return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
				}
				break;
			}
			default: {
				if (isEqualsDeep(lhs, rhs)) {
					return 0;
				}
				break;
			}
		}

		return null;
	}
}
