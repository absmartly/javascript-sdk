import { Evaluator } from "../evaluator";
import { UnaryOperator } from "./unary";
export declare class NotOperator extends UnaryOperator {
    unary(evaluator: Evaluator, arg: any): boolean;
}
