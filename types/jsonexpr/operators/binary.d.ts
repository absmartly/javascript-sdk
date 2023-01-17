import { Evaluator } from "../evaluator";
export declare abstract class BinaryOperator {
    abstract binary(evaluator: Evaluator, lhs: any, rhs: any): boolean | null;
    evaluate(evaluator: Evaluator, args: any[]): boolean | null;
}
