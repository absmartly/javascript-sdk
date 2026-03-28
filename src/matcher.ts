import { isObject } from "./utils";
import { JsonExpr } from "./jsonexpr/jsonexpr";

export class AudienceMatcher {
	private readonly _jsonExpr = new JsonExpr();

	evaluate(audienceString: string, vars: Record<string, unknown>): boolean | null {
		try {
			const audience = JSON.parse(audienceString);
			if (audience && audience.filter) {
				if (Array.isArray(audience.filter) || isObject(audience.filter)) {
					return this._jsonExpr.evaluateBooleanExpr(audience.filter, vars);
				}
			}
		} catch {
			// invalid JSON
		}
		return null;
	}
}
