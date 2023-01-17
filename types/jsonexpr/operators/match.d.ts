import { Evaluator } from "../evaluator";
import { BinaryOperator } from "./binary";
export declare class MatchOperator extends BinaryOperator {
    binary(evaluator: Evaluator, text: any, pattern: any): boolean | null;
}
