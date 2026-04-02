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

	evaluateRules(assignmentRulesString: string, environmentId: number | null, vars: Record<string, unknown>): number | null {
		let assignmentRules;
		try {
			assignmentRules = JSON.parse(assignmentRulesString);
		} catch (error) {
			console.error(error);
			return null;
		}

		if (!assignmentRules || !Array.isArray(assignmentRules.rules)) return null;

		for (const rule of assignmentRules.rules) {
			if (!rule) continue;

			if (Array.isArray(rule.environments) && rule.environments.length > 0) {
				if (environmentId == null || !rule.environments.includes(environmentId)) {
					continue;
				}
			}

			if (typeof rule.variant !== "number") continue;

			const conditions = rule.and;

			if (!conditions || (Array.isArray(conditions) && conditions.length === 0)) {
				return rule.variant;
			}

			if (!Array.isArray(conditions)) continue;

			const result = this._jsonExpr.evaluateBooleanExpr({ and: conditions }, vars);
			if (result === true) {
				return rule.variant;
			}
		}

		return null;
	}

	_jsonExpr = new JsonExpr();
}
