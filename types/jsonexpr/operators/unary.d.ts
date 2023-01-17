import { Evaluator } from "../evaluator";
export declare abstract class UnaryOperator {
    abstract unary(evaluator: Evaluator, arg: any): boolean;
    evaluate(evaluator: Evaluator, arg: any): boolean;
}
