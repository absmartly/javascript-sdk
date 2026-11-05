import { hashUnit } from "./hashing";
import { VariantAssigner } from "./assigner";
import { AudienceMatcher } from "./matcher";
import { insertUniqueSorted } from "./algorithm";
import { arrayEqualsShallow, isObject, isPromise } from "./utils";
import { SDK_VERSION } from "./version";
import { ContextNotReadyError, ContextFinalizedError } from "./errors";
import type {
	Assignment,
	Attribute,
	ContextData,
	Experiment,
	ExperimentData,
	Exposure,
	GoalAchievement,
	HoldoutData,
	HoldoutExperiment,
	Units,
	PublishParams,
	JSONValue,
	CustomFieldValue,
} from "./models";
import type {
	ClientRequestOptions,
	ContextDataProvider,
	ContextPublisher,
	EventLogger,
	EventName,
	ContextParams,
} from "./interfaces";

interface SDKLike {
	getClient(): {
		getAgent(): string;
		getApplication(): { name: string; version: number | string };
		getEnvironment(): string;
		publish(request: PublishParams, options?: ClientRequestOptions): Promise<unknown>;
		getContext(options?: Partial<ClientRequestOptions>): Promise<ContextData>;
	};
	getContextPublisher(): ContextPublisher;
	getContextDataProvider(): ContextDataProvider;
	getEventLogger(): EventLogger;
}

function isHeldOutBy(holdoutVariant: number, holdoutArmCount: number, fullOnVariant: number): boolean {
	if (holdoutVariant === 0) return true;
	if (holdoutArmCount === 3 && holdoutVariant === 1) return fullOnVariant === 0;
	return false;
}

type ContextOptionsInternal = {
	publisher?: ContextPublisher;
	dataProvider?: ContextDataProvider;
	eventLogger?: EventLogger;
	refreshPeriod: number;
	publishDelay: number;
	includeSystemAttributes?: boolean;
};

export class Context {
	private readonly _assigners: Record<string, VariantAssigner>;
	private readonly _attrs: Attribute[];
	private readonly _audienceMatcher: AudienceMatcher;
	private readonly _cassignments: Record<string, number>;
	private readonly _dataProvider: ContextDataProvider;
	private _environmentName: string | null = null;
	private readonly _eventLogger: EventLogger;
	private readonly _opts: ContextOptionsInternal;
	private readonly _publisher: ContextPublisher;
	private readonly _sdk: SDKLike;
	private readonly _units: Units;
	private _assignments: Record<string, Assignment> = {};
	private _data!: ContextData;
	private _exposures: Exposure[];
	private _failed: boolean;
	private _failedError: Error | null = null;
	private _finalized: boolean;
	private _finalizing: Promise<void> | null = null;
	private _goals: GoalAchievement[];
	private _index!: Record<string, Experiment>;
	private _indexVariables!: Record<string, Experiment[]>;
	private _holdoutsById: Record<number, HoldoutData> = {};
	private _holdoutAssignments: Record<string, Assignment> = {};
	private _overrides: Record<string, number>;
	private _pending: number;
	private _attrsSeq: number;
	private _attrsMapCache: Record<string, unknown> | null = null;
	private _attrsMapCacheSeq: number = -1;
	private _hashes?: Record<string, string | null>;
	private _promise?: Promise<ContextData | void>;
	private _publishTimeout?: ReturnType<typeof setTimeout>;
	private _refreshInterval?: ReturnType<typeof setInterval>;
	private _flushPromise?: Promise<Error | undefined>;

	constructor(
		sdk: SDKLike,
		options: ContextOptionsInternal,
		params: ContextParams,
		promise: ContextData | Promise<ContextData>
	) {
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
		this._audienceMatcher = new AudienceMatcher();
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
					this._failedError = error;
					delete this._promise;

					this._logError(error);
				});
		} else {
			this._init(promise as ContextData);
			this._logEvent("ready", promise as ContextData);
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

	readyError(): Error | null {
		return this._failedError;
	}

	ready(): Promise<true> {
		if (this.isReady()) {
			return Promise.resolve(true);
		}

		return new Promise((resolve) => {
			this._promise?.then(() => resolve(true)).catch(() => resolve(true));
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

	getSDK() {
		return this._sdk;
	}

	getOptions(): ContextOptionsInternal {
		return { ...this._opts };
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

		if (this._hashes) {
			delete this._hashes[unitType];
		}

		this._invalidateAssignmentsPinnedWithMissingUnit(unitType);
	}

	// A null holdout entry or a split rule resolved without its unit means the unit was missing when
	// the assignment was resolved. Evict so `_assign()` rebuilds it; already-exposed ones are kept
	// since re-resolving would queue a second, conflicting exposure.
	private _invalidateAssignmentsPinnedWithMissingUnit(unitType: string): void {
		for (const experimentName in this._assignments) {
			const assignment = this._assignments[experimentName]!;
			if (assignment.unitType !== unitType || assignment.exposed) continue;

			const hasMissingHoldoutEntry = assignment.holdoutAssignments?.some(
				(holdoutAssignment) => holdoutAssignment === null
			);

			if (hasMissingHoldoutEntry || assignment.isRuleMissingUnit) {
				delete this._assignments[experimentName];
			}
		}
	}

	getUnits() {
		return { ...this._units };
	}

	units(units: Record<string, number | string>) {
		for (const [unitType, uid] of Object.entries(units)) {
			this.unit(unitType, uid);
		}
	}

	getAttribute(attrName: string) {
		for (let i = this._attrs.length - 1; i >= 0; i--) {
			if (this._attrs[i]!.name === attrName) return this._attrs[i]!.value;
		}
		return undefined;
	}

	attribute(attrName: string, value: unknown) {
		if (typeof attrName !== "string" || attrName.trim().length === 0) {
			throw new Error("Attribute name must be a non-empty string");
		}
		this._checkNotFinalized();

		this._attrs.push({ name: attrName, value: value, setAt: Date.now() });
		this._attrsSeq++;
	}

	getAttributes() {
		const attributes: Record<string, unknown> = {};
		for (const a of this._attrs) {
			attributes[a.name] = a.value;
		}
		return attributes;
	}

	attributes(attrs: Record<string, unknown>) {
		for (const [attrName, value] of Object.entries(attrs)) {
			this.attribute(attrName, value);
		}
	}

	peek(experimentName: string) {
		if (typeof experimentName !== "string" || experimentName.trim().length === 0) {
			throw new Error("Experiment name must be a non-empty string");
		}
		this._checkReady(true);
		return this._peek(experimentName).variant;
	}

	treatment(experimentName: string) {
		if (typeof experimentName !== "string" || experimentName.trim().length === 0) {
			throw new Error("Experiment name must be a non-empty string");
		}
		this._checkReady(true);
		return this._treatment(experimentName).variant;
	}

	track(goalName: string, properties?: Record<string, unknown>) {
		if (typeof goalName !== "string" || goalName.trim().length === 0) {
			throw new Error("Goal name must be a non-empty string");
		}
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

	variableValue<T>(key: string, defaultValue: T): T {
		if (typeof key !== "string" || key.trim().length === 0) {
			throw new Error("Variable key must be a non-empty string");
		}
		this._checkReady(true);
		return this._variableValue(key, defaultValue);
	}

	peekVariableValue<T>(key: string, defaultValue: T): T {
		if (typeof key !== "string" || key.trim().length === 0) {
			throw new Error("Variable key must be a non-empty string");
		}
		this._checkReady(true);
		return this._peekVariable(key, defaultValue);
	}

	variableKeys() {
		this._checkReady(true);

		const variableExperiments: Record<string, unknown[]> = {};

		for (const [key, values] of Object.entries(this._indexVariables)) {
			for (const value of values) {
				if (variableExperiments[key]) variableExperiments[key].push(value.data.name);
				else variableExperiments[key] = [value.data.name];
			}
		}

		return variableExperiments;
	}

	override(experimentName: string, variant: number) {
		if (typeof experimentName !== "string" || experimentName.trim().length === 0) {
			throw new Error("Experiment name must be a non-empty string");
		}
		if (typeof variant !== "number" || variant < 0 || !Number.isInteger(variant)) {
			throw new Error("Variant must be a non-negative integer");
		}
		this._checkNotFinalized();
		this._overrides = Object.assign(this._overrides, { [experimentName]: variant });
	}

	overrides(experimentVariants: Record<string, number>) {
		for (const [experimentName, variant] of Object.entries(experimentVariants)) {
			this.override(experimentName, variant);
		}
	}

	customAssignment(experimentName: string, variant: number) {
		if (typeof experimentName !== "string" || experimentName.trim().length === 0) {
			throw new Error("Experiment name must be a non-empty string");
		}
		if (typeof variant !== "number" || variant < 0 || !Number.isInteger(variant)) {
			throw new Error("Variant must be a non-negative integer");
		}
		this._checkNotFinalized();
		this._cassignments[experimentName] = variant;
	}

	customAssignments(experimentVariants: Record<string, number>) {
		for (const [experimentName, variant] of Object.entries(experimentVariants)) {
			this.customAssignment(experimentName, variant);
		}
	}

	customFieldKeys() {
		this._checkReady(true);
		return this._customFieldKeys();
	}

	customFieldValue(experimentName: string, key: string) {
		if (typeof experimentName !== "string" || experimentName.trim().length === 0) {
			throw new Error("Experiment name must be a non-empty string");
		}
		if (typeof key !== "string" || key.trim().length === 0) {
			throw new Error("Key must be a non-empty string");
		}
		this._checkReady(true);
		return this._customFieldValue(experimentName, key);
	}

	customFieldValueType(experimentName: string, key: string) {
		if (typeof experimentName !== "string" || experimentName.trim().length === 0) {
			throw new Error("Experiment name must be a non-empty string");
		}
		if (typeof key !== "string" || key.trim().length === 0) {
			throw new Error("Key must be a non-empty string");
		}
		this._checkReady(true);
		return this._customFieldValueType(experimentName, key);
	}

	private _checkNotFinalized() {
		if (this.isFinalized()) {
			throw new ContextFinalizedError();
		} else if (this.isFinalizing()) {
			throw new ContextFinalizedError();
		}
	}

	private _checkReady(expectNotFinalized?: boolean) {
		if (!this.isReady()) {
			throw new ContextNotReadyError();
		}

		if (expectNotFinalized) {
			this._checkNotFinalized();
		}
	}

	private _getAttributesMap(): Record<string, unknown> {
		if (this._attrsMapCache !== null && this._attrsMapCacheSeq === this._attrsSeq) {
			return this._attrsMapCache;
		}
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
		for (const attr of this._attrs) {
			attrs[attr.name] = attr.value;
		}
		this._attrsMapCache = attrs;
		this._attrsMapCacheSeq = this._attrsSeq;
		return attrs;
	}

	private _evaluateAudience(audience: string): boolean | null {
		try {
			return this._audienceMatcher.evaluate(audience, this._getAttributesMap());
		} catch (error) {
			this._logError(error as Error);
			return null;
		}
	}

	private _resolveRule(experiment: ExperimentData, attrs: Record<string, unknown>, isUnitPinnedMissing: boolean) {
		const variantCount = experiment.variants.length;
		const action = this._audienceMatcher.evaluateRules(experiment.assignmentRules ?? "", this._environmentName, attrs);
		if (action == null) return null;

		if ("variant" in action) {
			const isInBounds = action.variant >= 0 && action.variant < variantCount;
			return isInBounds ? { variant: action.variant, isMissingUnit: false } : null;
		}
		if (action.split.length !== variantCount) return null;

		const unitType = experiment.unitType;
		const unit = unitType != null && !isUnitPinnedMissing ? this._unitHash(unitType) : null;
		if (unitType == null || unit === null) return { variant: experiment.fullOnVariant, isMissingUnit: true };

		const assigner =
			unitType in this._assigners
				? this._assigners[unitType]!
				: (this._assigners[unitType] = new VariantAssigner(unit));
		return { variant: assigner.assign(action.split, experiment.seedHi, experiment.seedLo), isMissingUnit: false };
	}

	private _assign(experimentName: string): Assignment {
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

			if (this._attrsSeq > assignment.attrsSeq || ruleKeyChanged) {
				const attrs = this._getAttributesMap();

				if (experiment.assignmentRules && experiment.assignmentRules.length > 0) {
					// An exposed split resolved without its unit keeps resolving as if the unit were still
					// missing, so a unit set afterwards cannot switch the variant the user already saw.
					const isUnitPinnedMissing = assignment.exposed && assignment.isRuleMissingUnit === true;
					const rule = this._resolveRule(experiment, attrs, isUnitPinnedMissing);
					const ruleVariant = rule?.variant ?? null;
					if (ruleVariant !== (assignment.ruleVariant ?? null)) {
						return false;
					}

					assignment.ruleVariant = ruleVariant;
					assignment.isRuleMissingUnit = rule?.isMissingUnit ?? false;
				}

				if (!assignment.ruleOverride && experiment.audience && experiment.audience.length > 0) {
					const result = this._evaluateAudience(experiment.audience);
					const newAudienceMismatch = typeof result === "boolean" ? !result : true;

					if (newAudienceMismatch !== assignment.audienceMismatch) {
						return false;
					}
				}

				assignment.ruleKey = ruleKey;
				assignment.attrsSeq = this._attrsSeq;
			}
			return true;
		};

		// (id, iteration) only: seed/split edits must not force a duplicate exposure.
		const holdoutSetMatches = (experiment: Experiment, assignment: Assignment) => {
			const freshHoldouts = experiment.holdouts ?? [];
			const pinnedHoldouts = assignment.holdouts ?? [];

			if (freshHoldouts.length !== pinnedHoldouts.length) {
				return false;
			}

			for (let i = 0; i < freshHoldouts.length; i++) {
				if (freshHoldouts[i]!.data.id !== pinnedHoldouts[i]!.data.id) {
					return false;
				}
				if (freshHoldouts[i]!.data.iteration !== pinnedHoldouts[i]!.data.iteration) {
					return false;
				}
			}

			return true;
		};

		const hasCustom = experimentName in this._cassignments;
		const hasOverride = experimentName in this._overrides;
		const experiment = experimentName in this._index ? this._index[experimentName]! : null;

		if (experimentName in this._assignments) {
			const assignment = this._assignments[experimentName]!;
			if (hasOverride) {
				if (
					assignment.overridden &&
					assignment.variant === this._overrides[experimentName]! &&
					(experiment == null || holdoutSetMatches(experiment, assignment))
				) {
					return assignment;
				}
			} else if (experiment == null) {
				if (!assignment.assigned) {
					return assignment;
				}
			} else if (
				assignment.suppressed ||
				assignment.ruleOverride ||
				!hasCustom ||
				this._cassignments[experimentName]! === assignment.variant
			) {
				// Suppressed assignments are forced to variant 0 and a matching rule wins over a custom
				// assignment, so a custom mismatch is not staleness.
				if (
					experimentMatches(experiment.data, assignment) &&
					audienceMatches(experiment.data, assignment) &&
					holdoutSetMatches(experiment, assignment)
				) {
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
			trafficSplit: null,
			variables: null,
			attrsSeq: 0,
		};

		this._assignments[experimentName] = assignment;

		// Resolved for overrides too: holdout exposures fire from `holdoutAssignments` regardless.
		if (experiment != null && experiment.holdouts != null && experiment.holdouts.length > 0) {
			const holdouts = experiment.holdouts;
			const holdoutUnitType = experiment.data.unitType;

			const holdoutAssignments: (Assignment | null)[] = holdouts.map((holdout) =>
				holdoutUnitType !== null ? this._getHoldoutAssignment(holdout, holdoutUnitType) : null
			);

			assignment.holdouts = holdouts;
			assignment.holdoutAssignments = holdoutAssignments;

			assignment.suppressed = holdoutAssignments.some(
				(holdoutAssignment) =>
					holdoutAssignment != null &&
					isHeldOutBy(holdoutAssignment.variant, holdoutAssignment.holdoutArmCount ?? 0, experiment.data.fullOnVariant)
			);
		}

		if (hasOverride) {
			if (experiment != null) {
				assignment.id = experiment.data.id;
				assignment.unitType = experiment.data.unitType;
			}

			assignment.overridden = true;
			assignment.variant = this._overrides[experimentName]!;
		} else {
			if (experiment != null) {
				const unitType = experiment.data.unitType;
				const attrs = this._getAttributesMap();

				// Set even when suppressed, or `audienceMatches` rebuilds (losing `exposed`) on every call.
				assignment.ruleKey = experiment.data.assignmentRules
					? `${experiment.data.assignmentRules}:${this._environmentName}`
					: "";

				const rule =
					experiment.data.assignmentRules && experiment.data.assignmentRules.length > 0
						? this._resolveRule(experiment.data, attrs, false)
						: null;
				const ruleVariant = rule?.variant ?? null;

				assignment.ruleVariant = ruleVariant;
				assignment.isRuleMissingUnit = rule?.isMissingUnit ?? false;

				// A matching assignment rule wins over holdout suppression, the same way override()
				// does: it's an explicit, author-specified assignment (flagged `ruleOverride`,
				// excluded from stats) rather than the experiment's own randomized/custom path, so
				// suppression only applies when no rule matched.
				if (ruleVariant !== null) {
					assignment.variant = ruleVariant;
					assignment.ruleOverride = true;
				} else if (assignment.suppressed) {
					assignment.assigned = false;
					assignment.variant = 0;
				} else {
					if (experiment.data.audience && experiment.data.audience.length > 0) {
						const result = this._evaluateAudience(experiment.data.audience);
						assignment.audienceMismatch = typeof result === "boolean" ? !result : true;
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
											? this._assigners[unitType]!
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
											assignment.variant = this._cassignments[experimentName]!;
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

				assignment.unitType = unitType;
				assignment.id = experiment.data.id;
				assignment.iteration = experiment.data.iteration;
				assignment.trafficSplit = experiment.data.trafficSplit;
				assignment.fullOnVariant = experiment.data.fullOnVariant;
				assignment.attrsSeq = this._attrsSeq;
			}
		}

		if (experiment != null && assignment.variant < experiment.data.variants.length) {
			assignment.variables = experiment.variables[assignment.variant] ?? null;
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

	private _triggerExposures(experimentName: string, assignment: Assignment): void {
		if (!assignment.suppressed || assignment.overridden || assignment.ruleOverride) {
			this._queueExposure(experimentName, assignment);
		}

		this._triggerApplicableHoldoutExposures(assignment);
	}

	// Uses the pinned snapshot, not a live re-resolution, so a refresh between the suppression
	// decision and here can't publish a holdout exposure from a different epoch.
	private _triggerApplicableHoldoutExposures(assignment: Assignment): void {
		const holdouts = assignment.holdouts;
		const holdoutAssignments = assignment.holdoutAssignments;
		if (!holdouts || !holdoutAssignments) return;

		holdoutAssignments.forEach((holdoutAssignment, i) => {
			if (holdoutAssignment == null) return;

			if (!holdoutAssignment.exposed) {
				holdoutAssignment.exposed = true;

				this._queueExposure(holdouts[i]!.data.name, holdoutAssignment);
			}
		});
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
		// The exposure is appended and counted BEFORE the (user-supplied) eventLogger runs, and
		// _setTimeout runs in a finally, so a throwing logger can never discard a queued exposure.
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

	private _customFieldValue(experimentName: string, key: string): JSONValue {
		const experiment = this._index[experimentName];

		if (experiment != null) {
			const field = experiment.data.customFieldValues?.find((x: CustomFieldValue) => x.name === key);
			if (field != null) {
				if (field.value === null) return null;

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
							this._logError(
								new Error(
									`Failed to parse JSON custom field value '${key}' for experiment '${experimentName}': ${
										(e as Error).message
									}`
								)
							);
							return null;
						}
					case "boolean":
						return field.value === "true";
					default:
						this._logError(
							new Error(
								`Unknown custom field type '${field.type}' for experiment '${experimentName}' and key '${key}' - you may need to upgrade to the latest SDK version`
							)
						);
						return null;
				}
			}
		}

		return null;
	}

	private _customFieldValueType(experimentName: string, key: string) {
		const experiment = this._index[experimentName];

		if (experiment != null) {
			const field = experiment.data.customFieldValues?.find((x: CustomFieldValue) => x.name === key);
			if (field != null) {
				return field.type;
			}
		}

		return null;
	}

	// A held-out unit reads the control value, not the caller's default, when nothing else wins.
	// The first suppressed candidate is captured even if it lacks the key, so a later one can't win.
	private _resolveVariableValue<T>(key: string, defaultValue: T, shouldQueueExposure: boolean): T {
		let suppressedFallback: Record<string, unknown> | undefined;

		for (const experiment of this._indexVariables[key] ?? []) {
			const experimentName = experiment.data.name;
			const assignment = this._assign(experimentName);
			if (assignment.variables != null) {
				if (shouldQueueExposure && !assignment.exposed) {
					assignment.exposed = true;
					this._triggerExposures(experimentName, assignment);
				}

				if (key in assignment.variables && (assignment.assigned || assignment.overridden || assignment.ruleOverride)) {
					return assignment.variables[key] as T;
				}

				if (
					assignment.suppressed &&
					!assignment.overridden &&
					!assignment.ruleOverride &&
					suppressedFallback === undefined
				) {
					suppressedFallback = assignment.variables;
				}
			}
		}

		if (suppressedFallback !== undefined && key in suppressedFallback) {
			return suppressedFallback[key] as T;
		}

		return defaultValue;
	}

	private _variableValue<T>(key: string, defaultValue: T): T {
		return this._resolveVariableValue(key, defaultValue, true);
	}

	private _peekVariable<T>(key: string, defaultValue: T): T {
		return this._resolveVariableValue(key, defaultValue, false);
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
		const goalEvent: GoalAchievement = { name: goalName, properties: props, achievedAt: Date.now() };
		this._logEvent("goal", goalEvent);

		this._goals.push(goalEvent);
		this._pending++;

		this._setTimeout();
	}

	private _setTimeout() {
		if (this.isReady()) {
			if (this._publishTimeout === undefined && this._opts.publishDelay >= 0) {
				this._publishTimeout = setTimeout(() => {
					// _flush already logs publish errors via the callback.
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

	// A caught exception or a rejected promise's reason can be any value. Only
	// a truthy reason survives the `if (error)` checks in `publish()`'s and
	// `finalize()`'s callbacks, so a falsy one (`undefined`, `null`, `false`)
	// must be replaced with a truthy `Error`; a truthy non-Error reason (e.g. a
	// plain string) is left as-is to preserve its original shape.
	private _asFailure(reason: unknown): Error {
		if (reason) {
			return reason as Error;
		}
		return new Error(`Publish failed with a falsy reason: ${String(reason)}`);
	}

	private _flush(
		callback?: (error?: Error) => void,
		requestOptions?: ClientRequestOptions
	): Promise<Error | undefined> {
		if (this._publishTimeout !== undefined) {
			clearTimeout(this._publishTimeout);
			delete this._publishTimeout;
		}

		// A flush is already in flight (it already reset `_pending` synchronously,
		// so a concurrent caller can't see it via `pending()`). Wait for it to settle
		// before re-evaluating, so callers like `finalize()` don't act on a queue that
		// only *looks* empty because the snapshot hasn't been restored/published yet.
		if (this._flushPromise) {
			return this._flushPromise.then(() => this._flush(callback, requestOptions));
		}

		if (this._pending === 0) {
			if (typeof callback === "function") {
				callback();
			}
			return Promise.resolve(undefined);
		}

		if (this._failed) {
			// _logError() isolates a throwing custom eventLogger internally, so it
			// (and the internal `callback` below, which only calls resolve/reject
			// and _logEvent()/_logError()) can't propagate an observer exception
			// out of _flush() — that would skip clearing
			// `_pending`/`_exposures`/`_goals` and, via `_finalize`'s callback never
			// running, permanently strand `_finalizing` with no settlement.
			this._logError(
				new Error(
					`Discarding ${this._exposures.length} exposures and ${this._goals.length} goals because context failed to initialize`
				)
			);

			this._pending = 0;
			this._exposures = [];
			this._goals = [];

			if (typeof callback === "function") {
				callback();
			}
			return Promise.resolve(undefined);
		}

		let request: PublishParams;
		try {
			request = {
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
		} catch (e) {
			const failure = this._asFailure(e);
			this._logError(failure);

			if (typeof callback === "function") {
				callback(failure);
			}
			return Promise.resolve(failure);
		}

		// Snapshot and reset synchronously before the async publish.
		// The data is already copied into `request` via .map(), so clearing
		// immediately is safe and allows new events to accumulate during the
		// in-flight publish. On failure, we restore the snapshot so the events
		// remain pending for a later flush. `_flushPromise` tracks this in-flight
		// attempt so concurrent callers (e.g. `finalize()`) can wait on it instead of
		// racing the synchronous reset above.
		const pendingCount = this._pending;
		const pendingExposures = this._exposures;
		const pendingGoals = this._goals;

		this._pending = 0;
		this._exposures = [];
		this._goals = [];

		// Routing the publisher call through a shared handler normalizes a
		// synchronously throwing custom publisher into the same restore/reject path
		// as an async rejection, so the snapshot is restored either way. The call
		// itself stays synchronous (no extra microtask hop) so timer-driven callers
		// observe the publish attempt within the same tick, as before.
		const onFailure = (reason: unknown): Error => {
			// A custom publisher can reject with any value, including a falsy one
			// (`undefined`, `null`, `false`). `publish()`/`finalize()` decide success
			// with `if (error)`, so a falsy reason would otherwise be mistaken for a
			// successful publish while this restored batch is left stranded. Normalize
			// only falsy reasons to a truthy `Error`; a truthy non-Error reason (e.g. a
			// plain string) is passed through unchanged to preserve its original shape.
			const e = this._asFailure(reason);

			this._pending += pendingCount;
			// Prepend rather than append: the restored batch failed to send while
			// this._exposures/this._goals were already accumulating newer events
			// recorded during the in-flight publish, so appending would put the
			// older, previously-recorded events after the newer ones — reordering
			// exposures/goals as seen by the collector.
			this._exposures = pendingExposures.concat(this._exposures);
			this._goals = pendingGoals.concat(this._goals);

			this._logError(e);

			// `callback` is internal glue (from `publish()`/`finalize()`); it only
			// calls resolve/reject and _logEvent()/_logError() (both of which
			// isolate a throwing custom eventLogger internally), so it can't throw.
			if (typeof callback === "function") {
				callback(e);
			}

			return e;
		};

		// The batch has already been delivered by this point, so an exception from
		// observing that success (e.g. a throwing custom eventLogger) must not be
		// treated as a publish failure — that would incorrectly restore and resend
		// an already-delivered batch. `_logEvent()` isolates the observer exception
		// internally, and `callback()` still runs unconditionally afterward so
		// `publish()`/`finalize()`'s own promise settles either way.
		const onSuccess = (): undefined => {
			this._logEvent("publish", request);

			if (typeof callback === "function") {
				callback();
			}

			return undefined;
		};

		let publishResult: Promise<unknown>;
		try {
			// `Promise.resolve(...)` normalizes the extension point: a custom
			// publisher is only required to conform to `ContextPublisher`'s type at
			// compile time, but nothing stops a runtime implementation from
			// returning a non-Promise (e.g. a bare boolean from a beacon-style
			// publisher, or a forgotten `return`). Without normalizing, the `.then`
			// access below would throw synchronously outside this `try`, bricking
			// the flush before the queue could be restored or the callback invoked.
			publishResult = Promise.resolve(this._publisher.publish(request, this._sdk, this, requestOptions));
		} catch (e) {
			const result = onFailure(e);
			this._flushPromise = undefined;
			return Promise.resolve(result);
		}

		// Neither `onSuccess` nor `onFailure` throws (both isolate observer
		// exceptions internally), so `.then(onSuccess, onFailure)` never rejects.
		// The `_flushPromise` cleanup below still uses the two-argument `.then()`
		// form defensively, so a flush can never get stuck referencing a settled
		// promise.
		this._flushPromise = publishResult.then(onSuccess, onFailure).then(
			(result) => {
				this._flushPromise = undefined;
				return result;
			},
			(e) => {
				this._flushPromise = undefined;
				throw e;
			}
		);

		return this._flushPromise;
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

	private _logEvent(eventName: EventName, data?: unknown) {
		if (this._eventLogger) {
			try {
				this._eventLogger(this, eventName, data as any);
			} catch (observerError) {
				// A throwing custom eventLogger must never propagate: every call site treats logging
				// as a side effect, and an escaping observer exception corrupts unrelated control flow.
				console.error(observerError);
			}
		}
	}

	private _logError(error: Error) {
		if (this._eventLogger) {
			try {
				this._eventLogger(this, "error", error);
			} catch (observerError) {
				console.error(observerError);
			}
		}
	}

	private _unitHash(unitType: string): string | null {
		if (!this._hashes) {
			this._hashes = {};
		}

		if (!(unitType in this._hashes)) {
			// Never cache `null`: the unit can still be set later (see `_getHoldoutAssignment`).
			if (!(unitType in this._units)) {
				return null;
			}

			const hash = hashUnit(this._units[unitType]!);
			this._hashes[unitType] = hash;
			return hash;
		}

		return this._hashes[unitType]!;
	}

	private _getHoldoutAssignment(holdout: HoldoutExperiment, unitType: string): Assignment | null {
		// `holdout` may predate a refresh; prefer the live definition.
		const liveHoldoutData = this._holdoutsById[holdout.data.id] ?? holdout.data;

		const cacheKey = `${liveHoldoutData.id}:${unitType}`;
		const cached = this._holdoutAssignments[cacheKey];
		if (cached && cached.id === liveHoldoutData.id && cached.iteration === liveHoldoutData.iteration) {
			return cached;
		}

		const unit = this._unitHash(unitType);
		if (unit === null) {
			return null;
		}

		const assigner =
			unitType in this._assigners
				? this._assigners[unitType]!
				: (this._assigners[unitType] = new VariantAssigner(unit));

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
			trafficSplit: null,
			variables: null,
			attrsSeq: 0,
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

		const holdoutsById: Record<number, HoldoutData> = {};
		for (const holdout of data.holdouts || []) {
			if (holdout.split && holdout.split.length > 0) {
				holdoutsById[holdout.id] = holdout;
			}
		}
		this._holdoutsById = holdoutsById;

		const holdoutExperiments: Record<number, HoldoutExperiment> = {};
		const resolveHoldoutExperiment = (holdoutId: number): HoldoutExperiment | undefined => {
			if (holdoutExperiments[holdoutId]) {
				return holdoutExperiments[holdoutId];
			}

			const holdoutData = holdoutsById[holdoutId];
			if (!holdoutData) {
				return undefined;
			}

			const holdoutEntry: HoldoutExperiment = { data: holdoutData };
			holdoutExperiments[holdoutId] = holdoutEntry;
			return holdoutEntry;
		};

		for (const experiment of data.experiments || []) {
			const variables: Record<string, unknown>[] = [];

			let holdouts: HoldoutExperiment[] | null = null;
			if (experiment.holdoutIds && experiment.holdoutIds.length > 0) {
				const resolved: HoldoutExperiment[] = [];

				for (const holdoutId of experiment.holdoutIds) {
					const holdoutExperiment = resolveHoldoutExperiment(holdoutId);
					if (holdoutExperiment) {
						insertUniqueSorted(resolved, holdoutExperiment, (a, b) => a.data.id < b.data.id);
					}
				}

				holdouts = resolved.length > 0 ? resolved : null;
			}

			const entry: Experiment = {
				data: experiment,
				variables,
				holdouts,
			};

			index[experiment.name] = entry;

			for (let i = 0; i < experiment.variants.length; i++) {
				const variant = experiment.variants[i]!;
				const config = variant.config;
				let parsed: Record<string, unknown> = {};

				if (config != null && config.length > 0) {
					try {
						const value = JSON.parse(config);
						if (isObject(value)) {
							parsed = value as Record<string, unknown>;
						}
					} catch (error) {
						this._logError(
							new Error(
								`Failed to parse config for experiment '${experiment.name}' variant ${i}: ${(error as Error).message}`
							)
						);
					}
				}

				for (const key of Object.keys(parsed)) {
					const value = entry;
					if (indexVariables[key]) {
						insertUniqueSorted(
							indexVariables[key],
							value,
							(a, b) => (a as Experiment).data.id < (b as Experiment).data.id
						);
					} else indexVariables[key] = [value];
				}

				variables[i] = parsed;
			}
		}

		this._index = index;
		this._indexVariables = indexVariables;
		this._assignments = assignments;

		if (!this._failed && this._opts.refreshPeriod > 0 && !this._refreshInterval) {
			this._refreshInterval = setInterval(() => this._refresh(), this._opts.refreshPeriod);
		}
	}

	private _finalize(requestOptions?: ClientRequestOptions) {
		if (this._finalized) {
			return Promise.resolve();
		}

		if (this._finalizing) {
			return this._finalizing;
		}

		if (this._refreshInterval !== undefined) {
			clearInterval(this._refreshInterval);
			delete this._refreshInterval;
		}

		// `pending() === 0` alone is not sufficient: `_flush` resets `_pending`
		// synchronously before its publish settles, so a flush can be in flight
		// while the queue already looks empty. Only take the synchronous fast
		// path when nothing is pending AND no flush is in progress; otherwise
		// fall through to `_flush`, which itself waits for any in-flight attempt.
		if (this._pending === 0 && !this._flushPromise) {
			this._finalized = true;
			this._logEvent("finalize");

			return Promise.resolve();
		}

		// Assign `this._finalizing` BEFORE calling `_flush`, using a manually
		// created deferred rather than passing a callback into a `new
		// Promise(executor)`. `_flush`'s callback can fire synchronously (e.g.
		// from a synchronously throwing custom publisher, or the already-failed
		// fast path), and if it ran inside a `new Promise((resolve, reject) => {
		// this._flush(callback...) })` executor, it would run — and clear
		// `this._finalizing` — before that `new Promise(...)` expression itself
		// finished evaluating; the outer `this._finalizing = ...` assignment
		// would then immediately clobber the clear back to a non-null value,
		// leaving `isFinalizing()` stuck `true` forever. Setting `_finalizing`
		// up front, before `_flush` is even called, avoids that ordering
		// entirely: whether the callback fires synchronously or asynchronously,
		// `this._finalizing` is already the promise being resolved below.
		let resolveFinalizing!: () => void;
		let rejectFinalizing!: (error: Error) => void;
		const finalizing = new Promise<void>((resolve, reject) => {
			resolveFinalizing = resolve;
			rejectFinalizing = reject;
		});

		this._finalizing = finalizing;

		this._flush((error) => {
			if (this._finalizing === finalizing) {
				this._finalizing = null;
			}

			if (error) {
				rejectFinalizing(error);
			} else {
				this._finalized = true;

				// Settle the finalize promise before logging the event: even though
				// `_logEvent()` isolates a throwing custom eventLogger internally
				// (it never throws), resolving first means `finalizing` settles
				// exactly when the state it reflects (`_finalized`/`isFinalizing()`)
				// becomes true, rather than depending on the logger call completing.
				resolveFinalizing();
				this._logEvent("finalize");
			}
		}, requestOptions);

		return finalizing;
	}
}
