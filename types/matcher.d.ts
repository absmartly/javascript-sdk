import { JsonExpr } from "./jsonexpr/jsonexpr";
export declare class AudienceMatcher {
    evaluate(audienceString: string, vars: Record<string, unknown>): string | number | boolean | null;
    _jsonExpr: JsonExpr;
}
