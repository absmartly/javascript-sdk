import { isObject } from "./utils";
import { JsonExpr } from "./jsonexpr/jsonexpr";

export type RuleAction = { variant: number } | { split: number[] };

const SPLIT_PERCENTAGES_SUM_TOLERANCE = 0.01;

const parseSplitPercentages = (percentages: unknown) => {
	if (typeof percentages !== "string") return null;

	const values = percentages.split("/").map((value) => parseFloat(value));
	if (values.some((value) => isNaN(value) || value < 0)) return null;

	const total = values.reduce((sum, value) => sum + value, 0);
	if (parseFloat(Math.abs(100 - total).toFixed(2)) > SPLIT_PERCENTAGES_SUM_TOLERANCE) return null;

	return values.map((value) => value / 100);
};

const parseRuleAction = (rule: Record<string, unknown>): RuleAction | null => {
	switch (rule.type) {
		case "assign":
			return Number.isInteger(rule.variant) ? { variant: rule.variant as number } : null;
		case "split": {
			const split = parseSplitPercentages(rule.percentages);
			return split != null ? { split } : null;
		}
		default:
			return null;
	}
};

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

	evaluateRules(
		assignmentRulesString: string,
		environmentName: string | null,
		vars: Record<string, unknown>
	): RuleAction | null {
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

			const action = parseRuleAction(rule);
			if (action == null) continue;

			if (rule.environments != null) {
				if (!Array.isArray(rule.environments)) continue;

				if (rule.environments.length > 0) {
					if (environmentName == null || !rule.environments.includes(environmentName)) {
						continue;
					}
				}
			}

			const conditions = rule.conditions;

			if (conditions == null) {
				return action;
			}

			if (!isObject(conditions)) continue;

			try {
				const result = this._jsonExpr.evaluateBooleanExpr(conditions, vars);
				if (result === true) {
					return action;
				}
			} catch (e) {
				console.warn(`Failed to evaluate assignment rule conditions for rule ${rule.name}: ${e}`);
			}
		}

		return null;
	}

	_jsonExpr = new JsonExpr();
}
