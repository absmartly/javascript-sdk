import { isObject } from "./utils";
import { JsonExpr } from "./jsonexpr/jsonexpr";

export class AudienceMatcher {
	evaluate(audienceString: string, vars: Record<string, unknown>) {
		let audience;
		try {
			audience = JSON.parse(audienceString);
		} catch (_error) {
			return null;
		}

		if (audience && audience.filter) {
			if (Array.isArray(audience.filter) || isObject(audience.filter)) {
				return this._jsonExpr.evaluateBooleanExpr(audience.filter, vars);
			}
		}

		return null;
	}

	_jsonExpr = new JsonExpr();
}
