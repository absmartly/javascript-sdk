import { BinaryOperator } from "./binary";
import { isObject } from "../../utils";
import { Evaluator } from "../evaluator";

export class InOperator extends BinaryOperator {
	binary(evaluator: Evaluator, haystack: unknown, needle: string | number | boolean | null) {
		if (Array.isArray(haystack)) {
			for (const item of haystack) {
				if (evaluator.compare(item, needle) === 0) {
					return true;
				}
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
