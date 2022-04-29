import { isObject } from "./utils";
import { JsonExpr } from "./jsonexpr/jsonexpr";

export class AudienceMatcher {
	evaluate(audienceString, vars) {
		try {
			const audience = JSON.parse(audienceString);
			if (audience && audience.filter) {
				if (Array.isArray(audience.filter) || isObject(audience.filter)) {
					return this._jsonExpr.evaluateBooleanExpr(audience.filter, vars);
				}
			}
		} catch (e) {
			console.error(e);
		}

		return null;
	}

	_jsonExpr = new JsonExpr();
}
