import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";
export declare class GreaterThanOrEqualOperator extends BinaryOperator {
    binary(evaluator: Evaluator, lhs: any, rhs: any): boolean | null;
}
