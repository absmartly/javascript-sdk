export declare class Evaluator {
    private readonly operators;
    private readonly vars;
    constructor(operators: Record<string, any>, vars: Record<string, any>);
    evaluate(expr: Record<string, unknown> | any[]): any;
    booleanConvert(x: boolean | number | string): string | number | boolean;
    numberConvert(x: number | boolean | string): number | null;
    stringConvert(x: string | boolean | number): string | null;
    extractVar(path: string): Record<string, any> | null;
    compare(lhs: any, rhs: any): 1 | -1 | 0 | null;
}
