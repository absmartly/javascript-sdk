import { isObject } from "../../utils";
import { Evaluator } from "../evaluator";

export class VarOperator {
	evaluate(evaluator: Evaluator, path: unknown) {
		if (isObject(path)) {
			path = (path as { path: string }).path;
		}

		return typeof path === "string" ? evaluator.extractVar(path) : null;
	}
}
