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
		assignmentRulesString: string,
		environmentName: string | null,
		vars: Record<string, unknown>
	): number | null {
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

			if (rule.type !== "assign") continue;

			if (rule.environments != null) {
				if (!Array.isArray(rule.environments)) continue;

				if (rule.environments.length > 0) {
					if (environmentName == null || !rule.environments.includes(environmentName)) {
						continue;
					}
				}
			}

			if (typeof rule.variant !== "number") continue;
			if (rule.variant !== Math.floor(rule.variant)) continue;

			const conditions = rule.conditions;

			if (conditions == null) {
				return rule.variant;
			}

			if (!isObject(conditions)) continue;

			try {
				const result = this._jsonExpr.evaluateBooleanExpr(conditions, vars);
				if (result === true) {
					return rule.variant;
				}
			} catch (e) {
				console.warn(`Failed to evaluate assignment rule conditions for variant ${rule.variant}: ${e}`);
			}
		}

		return null;
	}

	_jsonExpr = new JsonExpr();
}
