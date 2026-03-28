import { isEqualsDeep, isObject } from "../utils";

export interface Operator {
	evaluate(evaluator: Evaluator, args: unknown): unknown;
}

function parseSemver(version: string) {
	let v = version;
	if (v.startsWith("v") || v.startsWith("V")) {
		v = v.substring(1);
	}

	const plusIndex = v.indexOf("+");
	if (plusIndex >= 0) {
		v = v.substring(0, plusIndex);
	}

	if (v === "") return null;

	const [core, ...preReleaseParts] = v.split("-");
	const preRelease = preReleaseParts.join("-");

	if (core === "") return null;

	const parts = core!.split(".");
	return { parts, preRelease };
}

const NUMERIC_IDENTIFIER = /^\d+$/;

function stripLeadingZeros(s: string): string {
	const stripped = s.replace(/^0+/, "");
	return stripped === "" ? "0" : stripped;
}

function compareIdentifiers(a: string, b: string): number {
	const aIsNum = NUMERIC_IDENTIFIER.test(a);
	const bIsNum = NUMERIC_IDENTIFIER.test(b);

	if (aIsNum && bIsNum) {
		const aNorm = stripLeadingZeros(a);
		const bNorm = stripLeadingZeros(b);
		if (aNorm.length !== bNorm.length) return aNorm.length > bNorm.length ? 1 : -1;
		return aNorm === bNorm ? 0 : aNorm > bNorm ? 1 : -1;
	}
	if (aIsNum) return -1;
	if (bIsNum) return 1;
	return a === b ? 0 : a > b ? 1 : -1;
}

export class Evaluator {
	private readonly operators: Record<string, Operator>;
	private readonly vars: Record<string, unknown>;

	constructor(operators: Record<string, Operator>, vars: Record<string, unknown>) {
		this.operators = operators;
		this.vars = vars;
	}

	evaluate(expr: unknown): unknown {
		if (Array.isArray(expr)) {
			return this.operators["and"]?.evaluate(this, expr) ?? null;
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

	booleanConvert(x: unknown): boolean {
		switch (typeof x) {
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

	numberConvert(x: unknown): number | null {
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

	stringConvert(x: unknown): string | null {
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

	extractVar(path: string): unknown {
		const frags = path.split("/");
		let target: unknown = this.vars ?? {};
		for (const frag of frags) {
			if (target !== null && typeof target === "object" && frag in (target as Record<string, unknown>)) {
				target = (target as Record<string, unknown>)[frag];
				continue;
			}
			return null;
		}
		return target;
	}

	versionCompare(lhs: unknown, rhs: unknown): number | null {
		const lhsStr = this.stringConvert(lhs);
		const rhsStr = this.stringConvert(rhs);
		if (lhsStr === null || rhsStr === null || lhsStr === "" || rhsStr === "") return null;

		const l = parseSemver(lhsStr);
		const r = parseSemver(rhsStr);
		if (l === null || r === null) return null;

		const maxLen = Math.max(l.parts.length, r.parts.length);
		for (let i = 0; i < maxLen; i++) {
			const lPart = l.parts[i] ?? "0";
			const rPart = r.parts[i] ?? "0";
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
			const result = compareIdentifiers(lPreParts[i]!, rPreParts[i]!);
			if (result !== 0) return result;
		}

		return 0;
	}

	compare(lhs: unknown, rhs: unknown): number | null {
		if (lhs === null) return rhs === null ? 0 : null;
		if (rhs === null) return null;

		switch (typeof lhs) {
			case "number": {
				const rvalue = this.numberConvert(rhs);
				if (rvalue !== null) return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
				break;
			}
			case "string": {
				const rvalue = this.stringConvert(rhs);
				if (rvalue !== null) return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
				break;
			}
			case "boolean": {
				const rvalue = this.booleanConvert(rhs);
				if (rvalue != null) return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
				break;
			}
			default: {
				if (isEqualsDeep(lhs, rhs)) return 0;
				break;
			}
		}

		return null;
	}
}
