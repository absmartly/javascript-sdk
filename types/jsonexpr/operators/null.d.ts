import { Evaluator } from "../evaluator";
import { UnaryOperator } from "./unary";
export declare class NullOperator extends UnaryOperator {
    unary(_: Evaluator, value: any): boolean;
}
