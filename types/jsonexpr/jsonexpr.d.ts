export declare class JsonExpr {
    evaluateBooleanExpr(expr: any[] | Record<string, unknown>, vars: Record<string, unknown>): string | number | boolean;
    evaluateExpr(expr: any[] | Record<string, unknown>, vars: Record<string, unknown>): any;
}
