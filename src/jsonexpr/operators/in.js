import { BinaryOperator } from "./binary";
import { isObject } from "../../utils";

export class InOperator extends BinaryOperator {
	binary(evaluator, haystack, needle) {
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
