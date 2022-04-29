export class UnaryOperator {
	evaluate(evaluator, arg) {
		arg = evaluator.evaluate(arg);
		return this.unary(evaluator, arg);
	}
}
