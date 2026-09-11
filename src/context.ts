import { arrayEqualsShallow, hashUnit, isObject, isPromise } from "./utils";
import { VariantAssigner } from "./assigner";
import { AudienceMatcher } from "./matcher";
import { insertUniqueSorted } from "./algorithm";
import SDK, { EventLogger, EventName } from "./sdk";
import { ContextPublisher, PublishParams } from "./publisher";
import { ContextDataProvider } from "./provider";
import { ClientRequestOptions } from "./client";
import { SDK_VERSION } from "./version";

type JSONPrimitive = string | number | boolean | null;
type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];
type JSONValue = JSONPrimitive | JSONObject | JSONArray;

type CustomFieldValueType = "text" | "string" | "number" | "json" | "boolean";

type CustomFieldValue = {
	name: string;
	value: string;
	type: CustomFieldValueType;
};

export type ExperimentData = {
	id: number;
	name: string;
	unitType: string | null;
	iteration: number;
	fullOnVariant: number;
	trafficSplit: number[];
	trafficSeedHi: number;
	trafficSeedLo: number;
	audience: string;
	assignmentRules?: string;
	audienceStrict: boolean;
	split: number[];
	seedHi: number;
	seedLo: number;
	variants: { config: null | string; name?: string }[];
	variables: Record<string, unknown>;
	variant: number;
	overridden: boolean;
	assigned: boolean;
	exposed: boolean;
	eligible: boolean;
	fullOn: boolean;
	custom: boolean;
	audienceMismatch: boolean;
	customFieldValues: CustomFieldValue[] | null;
	holdoutIds?: number[];
};

type Assignment = {
	id: number;
	iteration: number;
	fullOnVariant: number;
	unitType: string | null;
	variant: number;
	overridden: boolean;
	assigned: boolean;
	exposed: boolean;
	eligible: boolean;
	fullOn: boolean;
	custom: boolean;
	audienceMismatch: boolean;
	ruleOverride: boolean;
	ruleVariant?: number | null;
	ruleKey?: string;
	trafficSplit?: number[];
	variables?: Record<string, unknown>;
	attrsSeq?: number;
	suppressed?: boolean;
	holdouts?: Experiment[];
	holdoutAssignments?: (Assignment | null)[];
	// Only set on a holdout's own resolved Assignment (as returned by _getHoldoutAssignment): the
	// arm count (`split.length`) the holdout's definition had at the moment `variant` was
	// resolved. Pinned alongside `variant` rather than re-read from the live holdout definition,
	// so a same-iteration refresh that changes `split.length` can't desync the resolved arm from
	// the arm count used to interpret it (mirrors java-sdk's HoldoutAssignment, Context.java:1218-1222).
	holdoutArmCount?: number;
};

export type Experiment = {
	data: ExperimentData;
	variables: Record<string, unknown>[];
	holdouts?: Experiment[] | null;
};

export type Unit = {
	type: string;
	uid: string | null;
};

export type Exposure = {
	id: number;
	name: string;
	exposedAt: number;
	unit: string | null;
	variant: number;
	assigned: boolean;
	eligible: boolean;
	overridden: boolean;
	fullOn: boolean;
	custom: boolean;
	audienceMismatch: boolean;
	ruleOverride: boolean;
};

export type Attribute = {
	name: string;
	value: unknown;
	setAt: number;
};

export type Units = {
	[key: string]: string | number;
};

export type Goal = {
	name: string;
	properties: Record<string, unknown> | null;
	achievedAt: number;
};

export type ContextParams = {
	units: Record<string, string | number>;
};

export type ContextOptions = {
	publisher?: ContextPublisher;
	dataProvider?: ContextDataProvider;
	eventLogger?: EventLogger;
	refreshPeriod: number;
	publishDelay: number;
	includeSystemAttributes?: boolean;
};

export type ContextData = {
	experiments?: ExperimentData[];
	holdouts?: ExperimentData[];
};

// Ported verbatim from java-sdk's Context.isHeldOutBy (Context.java:1319-1330). Decides whether
// a single holdout's resolved arm suppresses the covered experiment it applies to.
function isHeldOutBy(holdoutVariant: number, holdoutArmCount: number, fullOnVariant: number): boolean {
	if (holdoutVariant === 0) return true;
	if (holdoutArmCount === 3 && holdoutVariant === 1) return fullOnVariant === 0;
	return false;
}

// Wraps a caught error so "no error occurred" (undefined) can be distinguished from "an error of
// value `undefined` was thrown" when collecting the first error across multiple try/catch sites
// (the covered experiment's own exposure attempt and the holdout-firing loop) that must share one
// "first error wins" outcome, mirroring java-sdk's triggerExposure (Context.java:481-503).
type CaughtError = { value: unknown } | undefined;

export default class Context {
	private readonly _assigners: Record<string, VariantAssigner>;
	private readonly _attrs: Attribute[];
	private readonly _audienceMatcher: AudienceMatcher;
	private readonly _cassignments: Record<string, number>;
	private readonly _dataProvider: ContextDataProvider;
	private _environmentName: string | null;
	private readonly _eventLogger: EventLogger;
	private readonly _opts: ContextOptions;
	private readonly _publisher: ContextPublisher;
	private readonly _sdk: SDK;
	private readonly _units: Units;
	private _assignments: Record<string, Assignment>;
	private _data: ContextData;
	private _exposures: Exposure[];
	private _failed: boolean;
	private _finalized: boolean;
	private _finalizing: boolean | Promise<void> | null;
	private _goals: Goal[];
	private _index: Record<string, Experiment>;
	private _indexVariables: Record<string, Experiment[]>;
	private _holdoutsById: Record<number, ExperimentData>;
	private _holdoutAssignments: Record<string, Assignment>;
	private _overrides: Record<string, number>;
	private _pending: number;
	private _attrsSeq: number;
	private _hashes?: Record<string, string | null>;
	private _promise?: Promise<ContextData | void>;
	private _publishTimeout?: ReturnType<typeof setTimeout>;
	private _refreshInterval?: ReturnType<typeof setInterval>;

	constructor(sdk: SDK, options: ContextOptions, params: ContextParams, promise: ContextData | Promise<ContextData>) {
		this._sdk = sdk;
		this._publisher = options.publisher || this._sdk.getContextPublisher();
		this._dataProvider = options.dataProvider || this._sdk.getContextDataProvider();
		this._eventLogger = options.eventLogger || this._sdk.getEventLogger();
		this._opts = options;
		this._pending = 0;
		this._failed = false;
		this._finalized = false;
		this._attrs = [];
		this._goals = [];
		this._exposures = [];
		this._overrides = {};
		this._cassignments = {};
		this._units = {};
		this._assigners = {};
		this._holdoutAssignments = {};
		this._audienceMatcher = new AudienceMatcher();
		this._environmentName = null;
		this._attrsSeq = 0;

		if (params.units) {
			this.units(params.units);
		}

		if (isPromise(promise)) {
			this._promise = (promise as Promise<ContextData>)
				.then((data) => {
					this._init(data);
					delete this._promise;

					this._logEvent("ready", data);

					if (this.pending() > 0) {
						this._setTimeout();
					}
				})
				.catch((error: Error) => {
					this._init({});

					this._failed = true;
					delete this._promise;

					this._logError(error);
				});
		} else {
			promise = promise as ContextData;
			this._init(promise);

			this._logEvent("ready", promise);
		}
	}

	isReady() {
		return this._promise === undefined;
	}

	isFinalizing() {
		return !this._finalized && this._finalizing != null;
	}

	isFinalized() {
		return this._finalized;
	}

	isFailed() {
		return this._failed;
	}

	ready() {
		if (this.isReady()) {
			return Promise.resolve(true);
		}

		return new Promise((resolve) => {
			this._promise?.then(() => resolve(true)).catch((e) => resolve(e));
		});
	}

	pending() {
		return this._pending;
	}

	data() {
		this._checkReady();

		return this._data;
	}

	eventLogger() {
		return this._eventLogger;
	}

	publisher() {
		return this._publisher;
	}

	provider() {
		return this._dataProvider;
	}

	publish(requestOptions?: ClientRequestOptions) {
		this._checkReady(true);

		return new Promise<void>((resolve, reject) => {
			this._flush((error?: Error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			}, requestOptions);
		});
	}

	refresh(requestOptions?: ClientRequestOptions) {
		this._checkReady(true);

		return new Promise<void>((resolve, reject) => {
			this._refresh((error?: Error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			}, requestOptions);
		});
	}

	getUnit(unitType: string) {
		return this._units[unitType];
	}

	unit(unitType: string, uid: string | number) {
		this._checkNotFinalized();

		switch (typeof uid) {
			case "string":
				uid = uid.trim();
				if (uid.length === 0) throw new Error(`Unit '${unitType}' UID must not be blank.`);
				break;
			case "number":
				break;
			default:
				throw new Error(`Unit '${unitType}' must be a string or a number.`);
		}

		const previous = this._units[unitType];
		if (previous !== undefined && previous !== uid) {
			throw new Error(`Unit '${unitType}' UID already set.`);
		}

		this._units[unitType] = uid;

		this._invalidateAssignmentsPinnedWithMissingUnit(unitType);
	}

	// Ported from java-sdk's invalidateAssignmentsPinnedWithMissingUnit (Context.java:325-381,
	// called from setUnit at line 344). A cached assignment's `holdoutAssignments` snapshot pins a
	// null entry when the covered experiment's unit was unavailable at the time it was resolved
	// (see `_getHoldoutAssignment`'s `unit === null` early return) — holdouts in that snapshot are
	// resolved using the covered experiment's own `unitType`, not each holdout's declared
	// unitType, so only installing THAT unit type can repair the null entry. Resolving the holdout
	// live later (rather than evicting and letting `_assign()` rebuild both the decision and its
	// exposures together) could publish a holdout verdict inconsistent with the cached experiment
	// decision, so we evict instead.
	//
	// Only unexposed assignments are evicted: eviction lets a later `_assign()`/`_treatment()` call
	// recompute (and re-fire) exposure from scratch, so evicting an already-exposed assignment
	// could publish a duplicate or contradictory experiment exposure. This is not protecting a
	// pristine record — an exposure queued before this call may already carry the late unit, since
	// publish() reads units from the live `_units` map — but the decision behind it was made
	// without that unit, and recomputation cannot repair a record already queued, only add a
	// second, conflicting one. The guard avoids compounding a degraded record.
	private _invalidateAssignmentsPinnedWithMissingUnit(unitType: string): void {
		for (const experimentName in this._assignments) {
			const assignment = this._assignments[experimentName];
			const holdoutAssignments = assignment.holdoutAssignments;

			if (holdoutAssignments && assignment.unitType === unitType && !assignment.exposed) {
				const hasMissingEntry = holdoutAssignments.some((holdoutAssignment) => holdoutAssignment === null);

				if (hasMissingEntry) {
					delete this._assignments[experimentName];
				}
			}
		}
	}

	getUnits() {
		return this._units;
	}

	units(units: Record<string, number | string>) {
		Object.entries(units).forEach(([unitType, uid]) => {
			this.unit(unitType, uid);
		});
	}

	getAttribute(attrName: string) {
		let result;

		this._attrs.forEach((attr) => {
			if (attr.name === attrName) result = attr.value;
		});

		return result;
	}

	attribute(attrName: string, value: unknown) {
		this._checkNotFinalized();

		this._attrs.push({ name: attrName, value: value, setAt: Date.now() });
		this._attrsSeq++;
	}

	getAttributes() {
		const attributes: Record<string, unknown> = {};
		this._attrs
			.map((a) => [a.name, a.value])
			.forEach(([key, value]) => {
				attributes[key as string] = value;
			});
		return attributes;
	}

	attributes(attrs: Record<string, unknown>) {
		Object.entries(attrs).forEach(([attrName, value]) => {
			this.attribute(attrName, value);
		});
	}

	peek(experimentName: string) {
		this._checkReady(true);

		return this._peek(experimentName).variant;
	}

	treatment(experimentName: string) {
		this._checkReady(true);

		return this._treatment(experimentName).variant;
	}

	track(goalName: string, properties?: Record<string, unknown>) {
		this._checkNotFinalized();

		return this._track(goalName, properties);
	}

	finalize(requestOptions?: ClientRequestOptions) {
		return this._finalize(requestOptions);
	}

	experiments() {
		this._checkReady();

		return this._data.experiments?.map((x) => x.name);
	}

	variableValue(key: string, defaultValue: string): string {
		this._checkReady(true);

		return this._variableValue(key, defaultValue);
	}

	peekVariableValue(key: string, defaultValue: string): string {
		this._checkReady(true);

		return this._peekVariable(key, defaultValue);
	}

	variableKeys() {
		this._checkReady(true);

		const variableExperiments: Record<string, unknown[]> = {};

		Object.entries(this._indexVariables).forEach(([key, values]) => {
			values.forEach((value) => {
				if (variableExperiments[key]) variableExperiments[key].push(value.data.name);
				else variableExperiments[key] = [value.data.name];
			});
		});

		return variableExperiments;
	}

	override(experimentName: string, variant: number) {
		this._overrides = Object.assign(this._overrides, { [experimentName]: variant });
	}

	overrides(experimentVariants: Record<string, number>) {
		Object.entries(experimentVariants).forEach(([experimentName, variant]) => {
			this.override(experimentName, variant);
		});
	}

	customAssignment(experimentName: string, variant: number) {
		this._checkNotFinalized();

		this._cassignments[experimentName] = variant;
	}

	customAssignments(experimentVariants: Record<string, number>) {
		Object.entries(experimentVariants).forEach(([experimentName, variant]) => {
			this.customAssignment(experimentName, variant);
		});
	}

	private _checkNotFinalized() {
		if (this.isFinalized()) {
			throw new Error("ABSmartly Context is finalized.");
		} else if (this.isFinalizing()) {
			throw new Error("ABSmartly Context is finalizing.");
		}
	}

	private _computeRuleVariant(
		assignmentRules: string,
		variantCount: number,
		attrs: Record<string, unknown>
	): number | null {
		const rawRuleVariant = this._audienceMatcher.evaluateRules(assignmentRules, this._environmentName, attrs);
		return rawRuleVariant !== null && rawRuleVariant >= 0 && rawRuleVariant < variantCount ? rawRuleVariant : null;
	}

	private _checkReady(expectNotFinalized?: boolean) {
		if (!this.isReady()) {
			throw new Error("ABSmartly Context is not yet ready.");
		}

		if (expectNotFinalized) {
			this._checkNotFinalized();
		}
	}

	private _getAttributesMap(): Record<string, unknown> {
		const attrs: Record<string, unknown> = {};
		if (this._opts.includeSystemAttributes === true) {
			const client = this._sdk.getClient();
			const app = client.getApplication();
			attrs["application"] = app.name;
			attrs["environment"] = client.getEnvironment() ?? null;
			if (
				(typeof app.version === "string" && app.version.length > 0) ||
				(typeof app.version === "number" && app.version > 0)
			) {
				attrs["app_version"] = app.version;
			}
		}
		this._attrs.forEach((attr) => {
			attrs[attr.name] = attr.value;
		});
		return attrs;
	}

	private _assign(experimentName: string) {
		const experimentMatches = (experiment: ExperimentData, assignment: Assignment) => {
			return (
				experiment.id === assignment.id &&
				experiment.unitType === assignment.unitType &&
				experiment.iteration === assignment.iteration &&
				experiment.fullOnVariant === assignment.fullOnVariant &&
				arrayEqualsShallow(experiment.trafficSplit, assignment.trafficSplit)
			);
		};

		const audienceMatches = (experiment: ExperimentData, assignment: Assignment) => {
			const ruleKey = experiment.assignmentRules ? `${experiment.assignmentRules}:${this._environmentName}` : "";
			const ruleKeyChanged = ruleKey !== (assignment.ruleKey ?? "");

			if (ruleKeyChanged) {
				if (!ruleKey && (assignment.ruleVariant != null || assignment.ruleOverride)) {
					assignment.ruleVariant = undefined;
					assignment.ruleOverride = false;
					assignment.ruleKey = undefined;
					return false;
				}
			}

			if (this._attrsSeq > (assignment.attrsSeq ?? 0) || ruleKeyChanged) {
				const attrs = this._getAttributesMap();

				if (experiment.assignmentRules && experiment.assignmentRules.length > 0) {
					const ruleVariant = this._computeRuleVariant(experiment.assignmentRules, experiment.variants.length, attrs);
					if (ruleVariant !== (assignment.ruleVariant ?? null)) {
						return false;
					}

					assignment.ruleVariant = ruleVariant;
				}

				if (!assignment.ruleOverride && experiment.audience && experiment.audience.length > 0) {
					const result = this._audienceMatcher.evaluate(experiment.audience, attrs);
					const newAudienceMismatch = typeof result === "boolean" ? !result : false;

					if (newAudienceMismatch !== assignment.audienceMismatch) {
						return false;
					}
				}

				assignment.ruleKey = ruleKey;
				assignment.attrsSeq = this._attrsSeq;
			}
			return true;
		};

		// Ported from java-sdk's Context.holdoutSetMatches (Context.java:991-1005). Compares the
		// pinned holdout set the cached assignment was built against with the freshly-resolved
		// applicable-holdout set by (id, iteration) per entry — not full deep-equality, since
		// cosmetic holdout edits (e.g. seed/split changes) on an unrelated field shouldn't force a
		// duplicate exposure. Only membership/identity changes (added/removed holdout, or an
		// existing one's id/iteration changing) invalidate the cached assignment.
		const holdoutSetMatches = (experiment: Experiment, assignment: Assignment) => {
			const freshHoldouts = experiment.holdouts ?? [];
			const pinnedHoldouts = assignment.holdouts ?? [];

			if (freshHoldouts.length !== pinnedHoldouts.length) {
				return false;
			}

			for (let i = 0; i < freshHoldouts.length; i++) {
				if (freshHoldouts[i].data.id !== pinnedHoldouts[i].data.id) {
					return false;
				}
				if (freshHoldouts[i].data.iteration !== pinnedHoldouts[i].data.iteration) {
					return false;
				}
			}

			return true;
		};

		const hasCustom = experimentName in this._cassignments;
		const hasOverride = experimentName in this._overrides;
		const experiment = experimentName in this._index ? this._index[experimentName] : null;

		if (experimentName in this._assignments) {
			const assignment = this._assignments[experimentName];
			if (hasOverride) {
				// The holdout set must be revalidated here too, mirroring the non-override
				// branch below — otherwise a holdout that becomes (or stops being) applicable
				// to an already-overridden experiment after a refresh is never picked up, and
				// assignment.holdouts/holdoutAssignments/suppressed stay frozen forever (Task 6
				// relies on holdoutAssignments to decide which holdouts' own exposures to fire).
				// `experiment == null` means there's no live experiment to check against, so
				// treat that as trivially matching (nothing to invalidate against).
				if (
					assignment.overridden &&
					assignment.variant === this._overrides[experimentName] &&
					(experiment == null || holdoutSetMatches(experiment, assignment))
				) {
					// override up-to-date
					return assignment;
				}
			} else if (experiment == null) {
				if (!assignment.assigned) {
					// previously not-running experiment
					return assignment;
				}
			} else if (assignment.suppressed || !hasCustom || this._cassignments[experimentName] === assignment.variant) {
				// When the assignment is currently suppressed, a custom-assignment variant
				// mismatch is expected (the holdout forces variant 0 regardless of the custom
				// assignment on file per scenario 211) and must not be treated as staleness on
				// its own — experimentMatches/audienceMatches/holdoutSetMatches below still gate
				// the return, so a real change (unit type, holdout set, etc.) still falls through
				// to a rebuild.
				if (
					experimentMatches(experiment.data, assignment) &&
					audienceMatches(experiment.data, assignment) &&
					holdoutSetMatches(experiment, assignment)
				) {
					// assignment up-to-date
					return assignment;
				}
			}
		}

		const assignment: Assignment = {
			id: 0,
			iteration: 0,
			fullOnVariant: 0,
			unitType: null,
			variant: 0,
			overridden: false,
			assigned: false,
			exposed: false,
			eligible: true,
			fullOn: false,
			custom: false,
			audienceMismatch: false,
			ruleOverride: false,
		};

		this._assignments[experimentName] = assignment;

		// Resolve applicable holdouts and compute suppression unconditionally — this must run
		// regardless of override/custom-assignment/rule-variant handling below, because a
		// holdout's own exposure (fired later, using assignment.holdoutAssignments) must fire
		// whether or not the covered experiment itself ends up overridden or suppressed.
		if (experiment != null && experiment.holdouts != null && experiment.holdouts.length > 0) {
			const holdouts = experiment.holdouts;
			const holdoutUnitType = experiment.data.unitType;

			const holdoutAssignments: (Assignment | null)[] = holdouts.map((holdout) =>
				holdoutUnitType !== null ? this._getHoldoutAssignment(holdout, holdoutUnitType) : null
			);

			assignment.holdouts = holdouts;
			assignment.holdoutAssignments = holdoutAssignments;

			let suppressed = false;
			holdoutAssignments.forEach((holdoutAssignment) => {
				if (holdoutAssignment != null) {
					// Read the arm count from the holdout's own pinned Assignment
					// (holdoutArmCount), not the live holdout definition (holdouts[i].data.split.length)
					// — the pinned Assignment's `variant` was resolved against whatever split
					// length was live at that time, and a same-iteration refresh can change
					// split.length without invalidating _getHoldoutAssignment's cache, so reading
					// the live value here could desync the resolved arm from the arm count used
					// to interpret it. See holdoutArmCount's doc comment on the Assignment type.
					if (
						isHeldOutBy(
							holdoutAssignment.variant,
							holdoutAssignment.holdoutArmCount ?? 0,
							experiment.data.fullOnVariant
						)
					) {
						suppressed = true;
					}
				}
			});

			assignment.suppressed = suppressed;
		}

		if (hasOverride) {
			if (experiment != null) {
				assignment.id = experiment.data.id;
				assignment.unitType = experiment.data.unitType;
			}

			assignment.overridden = true;
			assignment.variant = this._overrides[experimentName];
		} else {
			if (experiment != null) {
				const unitType = experiment.data.unitType;
				const attrs = this._getAttributesMap();

				// `ruleKey` is bookkeeping only (a cache key derived from the rules string + env,
				// not an evaluation of them against attrs), so it is always kept up to date —
				// including when suppressed — mirroring `attrsSeq` below, which is also set
				// unconditionally. Without this, a suppressed assignment would leave `ruleKey`
				// unset, and the cache-validity check in `audienceMatches` (above) would see
				// `ruleKeyChanged` as permanently true on every subsequent call for an experiment
				// with assignmentRules, forcing a full rebuild (losing `assignment.exposed`) on
				// every single treatment()/peek() call instead of only on a genuine change.
				assignment.ruleKey = experiment.data.assignmentRules
					? `${experiment.data.assignmentRules}:${this._environmentName}`
					: "";

				// Suppression is checked FIRST, before assignment rules (or audience, or the
				// traffic-split/fullOn path) get any say over the variant. Assignment rules are a
				// deterministic-per-attribute assignment mechanism — structurally the same category
				// as a custom assignment (scenario 211: custom assignment yields to suppression) —
				// not an override in the sense scenario 210 establishes (only an explicit override()
				// call is exempt from suppression). If a matching rule were allowed to set the
				// variant before this check, a held-out unit would be silently TREATED with the
				// rule's variant while its exposure-firing gate
				// (`!assignment.suppressed || assignment.overridden`, which does NOT include
				// `ruleOverride`) still suppresses its own exposure — the worst combination:
				// measured nothing, but received real treatment. Gating here means
				// `ruleVariant`/`ruleOverride` are never computed nor set when suppressed, so the
				// exposure gate needs no `ruleOverride` special-case: a suppressed assignment never
				// has `ruleOverride: true` in the first place.
				if (assignment.suppressed) {
					assignment.assigned = false;
					assignment.variant = 0;
				} else {
					let ruleVariant: number | null = null;

					if (experiment.data.assignmentRules && experiment.data.assignmentRules.length > 0) {
						ruleVariant = this._computeRuleVariant(
							experiment.data.assignmentRules,
							experiment.data.variants.length,
							attrs
						);
					}

					assignment.ruleVariant = ruleVariant;

					if (ruleVariant !== null) {
						assignment.variant = ruleVariant;
						assignment.ruleOverride = true;
					} else {
						if (experiment.data.audience && experiment.data.audience.length > 0) {
							const result = this._audienceMatcher.evaluate(experiment.data.audience, attrs);

							if (typeof result === "boolean") {
								assignment.audienceMismatch = !result;
							}
						}

						if (experiment.data.audienceStrict && assignment.audienceMismatch) {
							assignment.variant = 0;
						} else if (experiment.data.fullOnVariant === 0) {
							if (unitType !== null) {
								if (unitType in this._units) {
									const unit = this._unitHash(unitType);
									if (unit !== null) {
										const assigner =
											unitType in this._assigners
												? this._assigners[unitType]
												: (this._assigners[unitType] = new VariantAssigner(unit));
										const eligible =
											assigner.assign(
												experiment.data.trafficSplit,
												experiment.data.trafficSeedHi,
												experiment.data.trafficSeedLo
											) === 1;

										assignment.assigned = true;
										assignment.eligible = eligible;

										if (eligible) {
											if (hasCustom) {
												assignment.variant = this._cassignments[experimentName];
												assignment.custom = true;
											} else {
												assignment.variant = assigner.assign(
													experiment.data.split,
													experiment.data.seedHi,
													experiment.data.seedLo
												);
											}
										} else {
											assignment.variant = 0;
										}
									}
								}
							}
						} else {
							assignment.assigned = true;
							assignment.eligible = true;
							assignment.variant = experiment.data.fullOnVariant;
							assignment.fullOn = true;
						}
					}
				}

				// store these so we can detect changes to running experiment
				assignment.unitType = unitType;
				assignment.id = experiment.data.id;
				assignment.iteration = experiment.data.iteration;
				assignment.trafficSplit = experiment.data.trafficSplit;
				assignment.fullOnVariant = experiment.data.fullOnVariant;
				assignment.attrsSeq = this._attrsSeq;
			}
		}

		if (experiment != null && assignment.variant < experiment.data.variants.length) {
			assignment.variables = experiment.variables[assignment.variant];
		}

		return assignment;
	}

	private _peek(experimentName: string) {
		return this._assign(experimentName);
	}

	private _treatment(experimentName: string) {
		const assignment = this._assign(experimentName);

		if (!assignment.exposed) {
			assignment.exposed = true;

			this._triggerExposures(experimentName, assignment);
		}

		return assignment;
	}

	// Ported from java-sdk's triggerExposure (Context.java:481-503): the own-exposure attempt
	// and the holdout-firing loop share one "first error wins" outcome — a throwing eventLogger
	// on the OWN exposure must not prevent the holdout loop from running (and vice versa), and
	// whichever throws first is what ultimately propagates to the caller, only after both have
	// had a chance to fire. Shared by `_treatment` and `_variableValue`, whose exposure-firing
	// behavior is otherwise identical once the one-shot `exposed` gate has been checked.
	//
	// Every caught error is reported via `_logErrorSafely` as it's caught (unlike java-sdk, which
	// only ever surfaces the first): with N applicable holdouts there can be up to N+1 independent
	// exposure-firing attempts, and only one error can be rethrown to the caller, so without this
	// every failure past the first would otherwise vanish with no trace at all.
	private _triggerExposures(experimentName: string, assignment: Assignment): void {
		let firstError: CaughtError;

		// An override always fires its own exposure, even when the covered experiment is also
		// suppressed by a holdout: overriding replaces the resolved variant outright (the override's
		// value wins, not the holdout's), so its own exposure must still be observable. This mirrors
		// java-sdk's outcome for the override path (Context.java:1184-1244, triggerExposure at
		// Context.java:481-503) — java's override write path never sets `assignment.suppressed` at
		// all, so its own `!assignment.suppressed` exposure gate trivially always passes there. Our
		// JS port pins `suppressed` eagerly for the override path too (Task 4's deliberate
		// divergence, see Assignment.suppressed doc comment), so the exposure gate here must
		// special-case `overridden` explicitly to reproduce the same firing outcome.
		if (!assignment.suppressed || assignment.overridden) {
			try {
				this._queueExposure(experimentName, assignment);
			} catch (error) {
				this._logErrorSafely(error as Error);
				firstError = { value: error };
			}
		}

		const holdoutError = this._triggerApplicableHoldoutExposures(assignment);
		if (!firstError) {
			firstError = holdoutError;
		}

		if (firstError) {
			throw firstError.value;
		}
	}

	// Ported from java-sdk's triggerApplicableHoldoutExposures/triggerHoldoutExposure
	// (Context.java:481-546). Fires each applicable holdout's own exposure exactly once,
	// using the pinned `assignment.holdoutAssignments` snapshot (not a live re-resolution),
	// so a data refresh landing between the suppression decision and the exposure trigger
	// can't publish a holdout exposure from a different epoch (Context.java:505-514).
	// A throwing eventLogger for one holdout must not prevent siblings from firing: collect
	// the first error and return it (rather than throwing here) so the caller can combine it
	// with its own try/catch's outcome and issue a single final throw after everything has fired.
	private _triggerApplicableHoldoutExposures(assignment: Assignment): CaughtError {
		const holdouts = assignment.holdouts;
		const holdoutAssignments = assignment.holdoutAssignments;
		if (!holdouts || !holdoutAssignments) return undefined;

		let firstError: CaughtError;

		holdoutAssignments.forEach((holdoutAssignment, i) => {
			if (holdoutAssignment == null) return;

			if (!holdoutAssignment.exposed) {
				holdoutAssignment.exposed = true;

				try {
					this._queueExposure(holdouts[i].data.name, holdoutAssignment);
				} catch (error) {
					this._logErrorSafely(error as Error);
					if (!firstError) {
						firstError = { value: error };
					}
				}
			}
		});

		return firstError;
	}

	private _queueExposure(experimentName: string, assignment: Assignment) {
		const exposureEvent: Exposure = {
			id: assignment.id,
			name: experimentName,
			exposedAt: Date.now(),
			unit: assignment.unitType,
			variant: assignment.variant,
			assigned: assignment.assigned,
			eligible: assignment.eligible,
			overridden: assignment.overridden,
			fullOn: assignment.fullOn,
			custom: assignment.custom,
			audienceMismatch: assignment.audienceMismatch,
			ruleOverride: assignment.ruleOverride,
		};
		// The exposure is appended and counted BEFORE the (user-supplied) eventLogger runs: a
		// throwing logger must not discard the exposure itself, only fail to report it. _setTimeout
		// is scheduled in a finally so a throwing logger still flushes what's already queued.
		this._exposures.push(exposureEvent);
		this._pending++;

		try {
			this._logEvent("exposure", exposureEvent);
		} finally {
			this._setTimeout();
		}
	}

	private _customFieldKeys() {
		const keys = new Set<string>();

		if (!this._data.experiments) return [];

		for (const experiment of this._data.experiments) {
			if (experiment.customFieldValues != null) {
				for (const customFieldValues of experiment.customFieldValues) {
					keys.add(customFieldValues.name);
				}
			}
		}

		return Array.from(keys);
	}

	customFieldKeys() {
		this._checkReady(true);

		return this._customFieldKeys();
	}

	private _customFieldValue(experimentName: string, key: string): JSONValue {
		const experiment = this._index[experimentName];

		if (experiment != null) {
			const field = experiment.data.customFieldValues?.find((x) => x.name === key);
			if (field != null) {
				switch (field.type) {
					case "text":
					case "string":
						return field.value;
					case "number":
						return Number(field.value);
					case "json":
						try {
							if (field.value === "null") return null;
							if (field.value === "") return "";
							return JSON.parse(field.value);
						} catch (e) {
							console.error(`Failed to parse JSON custom field value '${key}' for experiment '${experimentName}'`);
							return null;
						}
					case "boolean":
						return field.value === "true";
					default:
						console.error(
							`Unknown custom field type '${field.type}' for experiment '${experimentName}' and key '${key}' - you may need to upgrade to the latest SDK version`
						);
						return null;
				}
			}
		}

		return null;
	}

	customFieldValue(experimentName: string, key: string) {
		this._checkReady(true);

		return this._customFieldValue(experimentName, key);
	}

	private _customFieldValueType(experimentName: string, key: string) {
		const experiment = this._index[experimentName];

		if (experiment != null) {
			const field = experiment.data.customFieldValues?.find((x) => x.name === key);
			if (field != null) {
				return field.type;
			}
		}

		return null;
	}

	customFieldValueType(experimentName: string, key: string) {
		this._checkReady(true);

		return this._customFieldValueType(experimentName, key);
	}

	private _variableValue(key: string, defaultValue: string): string {
		for (const i in this._indexVariables[key]) {
			const experimentName = this._indexVariables[key][i].data.name;
			const assignment = this._assign(experimentName);
			if (assignment.variables !== undefined) {
				if (!assignment.exposed) {
					assignment.exposed = true;

					this._triggerExposures(experimentName, assignment);
				}

				if (key in assignment.variables && (assignment.assigned || assignment.overridden || assignment.ruleOverride)) {
					return assignment.variables[key] as string;
				}
			}
		}

		return defaultValue;
	}

	private _peekVariable(key: string, defaultValue: string): string {
		for (const i in this._indexVariables[key]) {
			const experimentName = this._indexVariables[key][i].data.name;
			const assignment = this._assign(experimentName);
			if (assignment.variables !== undefined) {
				if (key in assignment.variables && (assignment.assigned || assignment.overridden || assignment.ruleOverride)) {
					return assignment.variables[key] as string;
				}
			}
		}

		return defaultValue;
	}

	private _validateGoal(goalName: string, properties?: Record<string, unknown>) {
		if (properties !== null && properties !== undefined) {
			if (!isObject(properties)) {
				throw new Error(`Goal '${goalName}' properties must be of type object.`);
			}

			return { ...properties };
		}

		return null;
	}

	private _track(goalName: string, properties?: Record<string, unknown>) {
		const props = this._validateGoal(goalName, properties);
		const goalEvent: Goal = { name: goalName, properties: props, achievedAt: Date.now() };
		this._logEvent("goal", goalEvent);

		this._goals.push(goalEvent);
		this._pending++;

		this._setTimeout();
	}

	private _setTimeout() {
		if (this.isReady()) {
			if (this._publishTimeout === undefined && this._opts.publishDelay >= 0) {
				this._publishTimeout = setTimeout(() => {
					this._flush();
				}, this._opts.publishDelay);
			}
		}
	}

	private _buildAttributes(): Attribute[] {
		const allAttributes: Attribute[] = [];

		if (this._opts.includeSystemAttributes === true) {
			const client = this._sdk.getClient();
			const app = client.getApplication();
			const now = Date.now();
			allAttributes.push(
				{ name: "sdk_name", value: client.getAgent(), setAt: now },
				{ name: "sdk_version", value: SDK_VERSION, setAt: now },
				{ name: "application", value: app.name, setAt: now },
				{ name: "environment", value: client.getEnvironment() ?? null, setAt: now }
			);
			if (
				(typeof app.version === "string" && app.version.length > 0) ||
				(typeof app.version === "number" && app.version > 0)
			) {
				allAttributes.push({ name: "app_version", value: app.version, setAt: now });
			}
		}

		for (const x of this._attrs) {
			allAttributes.push({ name: x.name, value: x.value, setAt: x.setAt });
		}

		return allAttributes;
	}

	private _flush(callback?: (error?: Error) => void, requestOptions?: ClientRequestOptions) {
		if (this._publishTimeout !== undefined) {
			clearTimeout(this._publishTimeout);
			delete this._publishTimeout;
		}

		if (this._pending === 0) {
			if (typeof callback === "function") {
				callback();
			}
		} else {
			if (!this._failed) {
				try {
					const request: PublishParams = {
						publishedAt: Date.now(),
						units: Object.entries(this._units).map((entry) => ({
							type: entry[0],
							uid: this._unitHash(entry[0]),
						})),
						hashed: true,
						sdkVersion: SDK_VERSION,
					};

					if (this._goals.length > 0) {
						request.goals = this._goals.map((x) => ({
							name: x.name,
							achievedAt: x.achievedAt,
							properties: x.properties,
						}));
					}

					if (this._exposures.length > 0) {
						request.exposures = this._exposures.map((x) => ({
							id: x.id,
							name: x.name,
							unit: x.unit,
							exposedAt: x.exposedAt,
							variant: x.variant,
							assigned: x.assigned,
							eligible: x.eligible,
							overridden: x.overridden,
							fullOn: x.fullOn,
							custom: x.custom,
							audienceMismatch: x.audienceMismatch,
							ruleOverride: x.ruleOverride,
						}));
					}

					const allAttributes = this._buildAttributes();
					if (allAttributes.length > 0) {
						request.attributes = allAttributes;
					}

					this._publisher
						.publish(request, this._sdk, this, requestOptions)
						.then(() => {
							this._logEvent("publish", request);

							if (typeof callback === "function") {
								callback();
							}
						})
						.catch((e: Error) => {
							this._logError(e);

							if (typeof callback === "function") {
								callback(e);
							}
						});
				} catch (e) {
					this._logError(e as Error);

					if (typeof callback === "function") {
						callback(e as Error);
					}
				}
			} else {
				if (typeof callback === "function") {
					callback();
				}
			}

			this._pending = 0;
			this._exposures = [];
			this._goals = [];
		}
	}

	private _refresh(callback?: (error?: Error) => void, requestOptions?: ClientRequestOptions) {
		if (!this._failed) {
			this._dataProvider
				.getContextData(this._sdk, requestOptions)
				.then((data: ContextData) => {
					this._init(data, this._assignments);

					this._logEvent("refresh", data);

					if (typeof callback === "function") {
						callback();
					}
				})
				.catch((e: Error) => {
					this._logError(e);

					if (typeof callback === "function") {
						callback(e);
					}
				});
		} else {
			if (typeof callback === "function") {
				callback();
			}
		}
	}

	private _logEvent(eventName: EventName, data?: Record<string, unknown>) {
		if (this._eventLogger) {
			this._eventLogger(this, eventName, data);
		}
	}

	private _logError(error: Error) {
		if (this._eventLogger) {
			this._eventLogger(this, "error", error);
		}
	}

	// Like `_logError`, but swallows a throw from the (user-supplied) eventLogger itself. Used at
	// exposure-firing call sites where reporting one failure must never prevent the remaining
	// exposure attempts (sibling holdouts, or the covered experiment's own) from still running.
	private _logErrorSafely(error: Error) {
		try {
			this._logError(error);
		} catch {
			// Deliberately ignored — see comment above.
		}
	}

	private _unitHash(unitType: string) {
		if (!this._hashes) {
			this._hashes = {};
		}

		if (!(unitType in this._hashes)) {
			// Only cache when the unit is actually available. A `null` result here means the unit
			// hasn't been set yet — that can change later (via `unit()`/`setUnit`), whereas a
			// resolved hash is stable for the unit's lifetime (the same unit type can only ever be
			// set once, enforced by `unit()`). Caching `null` would permanently poison this cache
			// for a unit type queried before it was set — e.g. `_getHoldoutAssignment` (unlike the
			// ordinary experiment-assignment path, which only calls `_unitHash` after already
			// checking `unitType in this._units`) calls this unconditionally, so a holdout resolved
			// via `peek()`/`_assign()` before its unit type is installed must be able to resolve
			// correctly once that unit later arrives, without a stale cached `null` blocking it.
			if (!(unitType in this._units)) {
				return null;
			}

			const hash = hashUnit(this._units[unitType]);
			this._hashes[unitType] = hash;
			return hash;
		}

		return this._hashes[unitType];
	}

	// Resolves the arm a unit falls into within a holdout itself (as opposed to resolving an
	// ordinary experiment's assignment, which is `_assign()`). Ported from java-sdk's
	// getHoldoutAssignment (Context.java:1412-1468), minus the read/write-lock dance: js is
	// single-threaded, so this simplifies to a plain memoized-by-(id, unitType) cache.
	//
	// `holdout` may be a stale reference (e.g. captured before a data refresh) so it is always
	// re-resolved against the live `_holdoutsById` index first (falling back to the caller-supplied
	// reference only if the id is no longer present, e.g. the holdout was removed by the latest
	// refresh) — this mirrors java-sdk's resolveLiveHoldout and ensures the cache is keyed and
	// validated against the currently-installed definition rather than a possibly-dead one.
	private _getHoldoutAssignment(holdout: Experiment, unitType: string): Assignment | null {
		const liveHoldoutData = this._holdoutsById[holdout.data.id] ?? holdout.data;

		const cacheKey = `${liveHoldoutData.id}:${unitType}`;
		const cached = this._holdoutAssignments[cacheKey];
		if (cached && cached.id === liveHoldoutData.id && cached.iteration === liveHoldoutData.iteration) {
			return cached;
		}

		const unit = this._unitHash(unitType);
		if (unit === null) {
			// No unit set for this unitType yet — mirrors java-sdk's `uid == null -> return null`.
			// Do not cache: a later call, once the unit is set, must recompute.
			return null;
		}

		const assigner =
			unitType in this._assigners ? this._assigners[unitType] : (this._assigners[unitType] = new VariantAssigner(unit));

		const assignment: Assignment = {
			id: liveHoldoutData.id,
			iteration: liveHoldoutData.iteration,
			fullOnVariant: 0,
			unitType,
			variant: assigner.assign(liveHoldoutData.split, liveHoldoutData.seedHi, liveHoldoutData.seedLo),
			overridden: false,
			assigned: true,
			exposed: false,
			eligible: true,
			fullOn: false,
			custom: false,
			audienceMismatch: false,
			ruleOverride: false,
			holdoutArmCount: liveHoldoutData.split.length,
		};

		this._holdoutAssignments[cacheKey] = assignment;

		return assignment;
	}

	private _init(data: ContextData, assignments: Record<string, Assignment> = {}) {
		this._data = data;
		this._environmentName = this._sdk.getClient().getEnvironment() ?? null;

		const index: Record<string, Experiment> = {};
		const indexVariables: Record<string, Experiment[]> = {};

		// Live index of holdout definitions by id, skipping holdouts with no/empty
		// split (they can never be assigned to, so they are treated as non-existent).
		// Kept as raw ExperimentData (not a resolved Experiment/Assignment) so later
		// lookups (e.g. resolving a holdout's own assignment) always read against the
		// currently-installed data rather than a possibly-stale cached reference.
		const holdoutsById: Record<number, ExperimentData> = {};

		(data.holdouts || []).forEach((holdout) => {
			if (holdout.split && holdout.split.length > 0) {
				holdoutsById[holdout.id] = holdout;
			}
		});

		this._holdoutsById = holdoutsById;

		// Experiment wrappers (data + parsed variables) for holdouts, built lazily and
		// memoized per _init() call so a holdout referenced by multiple experiments is
		// only parsed once.
		const holdoutExperiments: Record<number, Experiment> = {};

		const resolveHoldoutExperiment = (holdoutId: number): Experiment | undefined => {
			if (holdoutExperiments[holdoutId]) {
				return holdoutExperiments[holdoutId];
			}

			// Read via the live field (not the local `holdoutsById` closure) so this
			// always resolves against the currently-installed data.
			const holdoutData = this._holdoutsById[holdoutId];
			if (!holdoutData) {
				return undefined;
			}

			const holdoutEntry: Experiment = {
				data: holdoutData,
				variables: [],
			};

			holdoutExperiments[holdoutId] = holdoutEntry;
			return holdoutEntry;
		};

		(data.experiments || []).forEach((experiment) => {
			const variables: Record<string, unknown>[] = [];

			let holdouts: Experiment[] | null = null;
			if (experiment.holdoutIds && experiment.holdoutIds.length > 0) {
				const resolved: Experiment[] = [];

				experiment.holdoutIds.forEach((holdoutId) => {
					const holdoutExperiment = resolveHoldoutExperiment(holdoutId);
					if (holdoutExperiment) {
						insertUniqueSorted(resolved, holdoutExperiment, (a, b) => a.data.id < b.data.id);
					}
				});

				holdouts = resolved.length > 0 ? resolved : null;
			}

			const entry: Experiment = {
				data: experiment,
				variables,
				holdouts,
			};

			index[experiment.name] = entry;

			experiment.variants.forEach((variant, i) => {
				const config = variant.config;
				const parsed = config != null && config.length > 0 ? JSON.parse(config) : {};

				Object.keys(parsed).forEach((key) => {
					const value = entry;
					if (indexVariables[key]) {
						insertUniqueSorted(
							indexVariables[key],
							value,
							(a, b) => (a as Experiment).data.id < (b as Experiment).data.id
						);
					} else indexVariables[key] = [value];
				});

				variables[i] = parsed;
			});
		});

		this._index = index;
		this._indexVariables = indexVariables;
		this._assignments = assignments;

		if (!this._failed && this._opts.refreshPeriod > 0 && !this._refreshInterval) {
			this._refreshInterval = setInterval(() => this._refresh(), this._opts.refreshPeriod);
		}
	}

	private _finalize(requestOptions?: ClientRequestOptions) {
		if (!this._finalized) {
			if (!this._finalizing) {
				if (this._refreshInterval !== undefined) {
					clearInterval(this._refreshInterval);
					delete this._refreshInterval;
				}

				if (this.pending() > 0) {
					this._finalizing = new Promise<void>((resolve, reject) => {
						this._flush((error) => {
							this._finalizing = null;

							if (error) {
								reject(error);
							} else {
								this._finalized = true;
								this._logEvent("finalize");

								resolve();
							}
						}, requestOptions);
					});

					return this._finalizing;
				}

				this._finalized = true;
				this._logEvent("finalize");

				return Promise.resolve();
			}

			return this._finalizing;
		}

		return Promise.resolve();
	}
}
