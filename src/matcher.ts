import { isObject } from "./utils";
import { JsonExpr } from "./jsonexpr/jsonexpr";

export class AudienceMatcher {
	evaluate(audienceString: string, vars: Record<string, unknown>) {
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

	evaluateRules(
		audienceString: string,
		environmentName: string | null,
		vars: Record<string, unknown>
	): number | null {
		try {
			const audience = JSON.parse(audienceString);
			if (audience && Array.isArray(audience.rules)) {
				for (const ruleGroup of audience.rules) {
					if (!ruleGroup || !Array.isArray(ruleGroup.or)) continue;
					for (const rule of ruleGroup.or) {
						if (Array.isArray(rule.environments) && rule.environments.length > 0) {
							if (environmentName == null || !rule.environments.includes(environmentName)) {
								continue;
							}
						}
						const conditions = rule.and;
						if (!conditions || (Array.isArray(conditions) && conditions.length === 0)) {
							return typeof rule.variant === "number" ? rule.variant : null;
						}
						if (Array.isArray(conditions)) {
							const result = this._jsonExpr.evaluateBooleanExpr({ and: conditions }, vars);
							if (result === true) {
								return typeof rule.variant === "number" ? rule.variant : null;
							}
						}
					}
				}
			}
		} catch (error) {
			console.error(error);
		}
		return null;
	}

	_jsonExpr = new JsonExpr();
}
