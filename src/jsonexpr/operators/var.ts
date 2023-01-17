import { isObject } from "../../utils";
import { Evaluator } from "../evaluator";

export class VarOperator {
	evaluate(evaluator: Evaluator, path: any) {
		if (isObject(path)) {
			path = path.path;
		}

		return typeof path === "string" ? evaluator.extractVar(path) : null;
	}
}
