import { isObject } from "../../utils";

export class VarOperator {
	evaluate(evaluator, path) {
		if (isObject(path)) {
			path = path.path;
		}

		return typeof path === "string" ? evaluator.extractVar(path) : null;
	}
}
