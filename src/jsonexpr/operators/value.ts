import { Evaluator } from "../evaluator";

export class ValueOperator {
	evaluate(_: Evaluator, value: unknown) {
		return value;
	}
}
