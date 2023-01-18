/* eslint-disable */
import { isEqualsDeep, isObject } from "../utils";

export class Evaluator {
	private readonly operators: any;
	private readonly vars: any;

	constructor(operators: any, vars: any) {
		this.operators = operators;
		this.vars = vars;
	}

	evaluate(expr: any) {
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

	booleanConvert(x: any) {
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

	numberConvert(x: any) {
		const type = typeof x;
		switch (type) {
			case "number":
				return parseFloat(x);
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

	stringConvert(x: any) {
		const type = typeof x;
		switch (type) {
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

	extractVar(path: any) {
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

	compare(lhs: any, rhs: any) {
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
				if (rvalue !== null) {
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
