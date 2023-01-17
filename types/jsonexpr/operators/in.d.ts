import { BinaryOperator } from "./binary";
import { Evaluator } from "../evaluator";
export declare class InOperator extends BinaryOperator {
    binary(evaluator: Evaluator, haystack: any, needle: any): any;
}
