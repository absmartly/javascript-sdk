import { arrayEqualsShallow, hashUnit, isObject, isPromise } from "./utils";
import { VariantAssigner } from "./assigner";
import { AudienceMatcher } from "./matcher";
import { insertUniqueSorted } from "./algorithm";
import SDK, { EventLogger, EventName } from "./sdk";
import { ContextPublisher, PublishParams } from "./publisher";
import { ContextDataProvider } from "./provider";
import { ClientRequestOptions } from "./client";
import { SDK_VERSION } from "./version";
import {
	assignSwitchbackPeriod,
	legacySwitchbackServing,
	resolveSwitchbackPath,
	resolveSwitchbackServing,
	sameSwitchbackIdentity,
	switchbackPeriodIndex,
	switchbackSources,
	SWITCHBACK_ABSENT,
	SWITCHBACK_ELIGIBLE,
	SWITCHBACK_INELIGIBLE,
} from "./switchback";
// A separate `import type`: inline `type` specifiers would need TypeScript 4.5 to read the published
// declarations, and 1.13.4 consumers compile with 3.9.
import type { SwitchbackServing, SwitchbackSources } from "./switchback";

const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

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

const DEFERRED_REPLAY_ROUNDS = 32;
const DEFERRED_REPLAY_CALLBACKS = 1024;
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
	// Switchback experiments (R33). Absent on unit experiments; only `randomizationType`,
	// `switchbackClusters`, `switchbackClusterValues`, `switchbackStartAt` and `switchbackPeriodMs`
	// affect serving. `switchbackClusters` maps a unit type to an attribute path; its key order is
	// the declared serving order.
	randomizationType?: string | null;
	switchbackClusters?: Record<string, string> | null;
	switchbackClusterValues?: string[] | null;
	switchbackStartAt?: number | null;
	switchbackPeriodMs?: number | null;
	switchbackCarryoverDurationMs?: number | null;
	switchbackBurnInDurationMs?: number | null;
	switchbackBurnOutDurationMs?: number | null;
	switchbackDesignType?: string | null;
	switchbackEstimand?: string | null;
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
	isRuleMissingUnit?: boolean;
	ruleKey?: string;
	trafficSplit?: number[];
	variables?: Record<string, unknown>;
	attrsSeq?: number;
	suppressed?: boolean;
	holdouts?: HoldoutExperiment[];
	holdoutAssignments?: (Assignment | null)[];
	// `split.length` at the time `variant` was resolved; a same-iteration refresh can change
	// the live value without invalidating the cache.
	holdoutArmCount?: number;
	// Set only on switchback assignments: the generation they were resolved under, the serving unit
	// and cluster key read for their period slot, the custom assignment read while resolving, and
	// whether the resolution records no exposure (no linked unit, an ineligible cluster, no period).
	switchbackGeneration?: number;
	switchbackServing?: SwitchbackServing;
	switchbackCustom?: number;
	switchbackSilent?: boolean;
};

// The cache slots of one switchback experiment, all of one generation and kept apart from
// `_assignments` so no experiment name can collide with them: the period-less slot (before the anchor
// or with an unservable schedule) and at most SWITCHBACK_RETAINED_PERIODS period slots.
type SwitchbackEpoch = {
	generation: number;
	periods: number[];
	slots: Record<number, Assignment>;
	periodless?: Assignment;
};

const SWITCHBACK_RETAINED_PERIODS = 2;

export type HoldoutData = {
	id: number;
	name: string;
	unitType?: string | null;
	iteration: number;
	seedHi: number;
	seedLo: number;
	split: number[];
	holdoutType?: string;
};

export type HoldoutExperiment = {
	data: HoldoutData;
};

export type Experiment = {
	data: ExperimentData;
	variables: Record<string, unknown>[];
	holdouts?: HoldoutExperiment[] | null;
	// Parsed `data.assignmentRules`, filled on first use; `undefined` until then. The entry is rebuilt
	// whenever context data is installed, so the cache never outlives the rules it was parsed from.
	rules?: unknown[] | null;
	/**
	 * @internal Identity of the rules and configured environment, built once when context data is installed
	 * so a cached read compares one string instead of re-concatenating the full rules JSON.
	 */
	ruleKey?: string;
	// Set only for a switchback experiment: its generation, carried over a refresh while its
	// switchback identity is unchanged, and its cluster sources (null on the legacy path).
	switchback?: { generation: number; sources: SwitchbackSources | null };
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
	ruleOverride?: boolean;
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
	// Publishes `sdk_name` and `sdk_version`. Audiences always see `application` and `environment` regardless.
	includeSystemAttributes?: boolean;
};

export type ContextData = {
	experiments?: ExperimentData[];
	holdouts?: HoldoutData[];
};

function isHeldOutBy(holdoutVariant: number, holdoutArmCount: number, fullOnVariant: number): boolean {
	if (holdoutVariant === 0) return true;
	if (holdoutArmCount === 3 && holdoutVariant === 1) return fullOnVariant === 0;
	return false;
}

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
	private _failedError: Error | null;
	private _finalized: boolean;
	private _finalizing: Promise<void> | null;
	private _goals: Goal[];
	private _index: Record<string, Experiment>;
	private _indexVariables: Record<string, Experiment[]>;
	private _holdoutsById: Record<number, HoldoutData>;
	private _holdoutAssignments: Record<string, Assignment>;
	private _overrides: Record<string, number>;
	private _pending: number;
	// While a variable read runs, user eventLogger callbacks it would trigger are held here (the
	// list is created on first use) and replayed once every exposure of the read is queued.
	private _deferringLogs = false;
	private _replayExhausted = false;
	private _deferredLogs?: [EventName, Record<string, unknown> | Error][];
	private _attrsSeq: number;
	private _attrsMapCache: Record<string, unknown> | null;
	private _attrsMapCacheSeq: number;
	private _switchbackGenerations: number;
	private _switchbackEpochs?: Record<string, SwitchbackEpoch>;
	private _hashes?: Record<string, string | null>;
	private _promise?: Promise<ContextData | void>;
	private _publishTimeout?: ReturnType<typeof setTimeout>;
	private _refreshInterval?: ReturnType<typeof setInterval>;
	private _flushPromise?: Promise<Error | undefined>;

	constructor(sdk: SDK, options: ContextOptions, params: ContextParams, promise: ContextData | Promise<ContextData>) {
		this._sdk = sdk;
		this._publisher = options.publisher || this._sdk.getContextPublisher();
		this._dataProvider = options.dataProvider || this._sdk.getContextDataProvider();
		this._eventLogger = options.eventLogger || this._sdk.getEventLogger();
		this._opts = options;
		this._pending = 0;
		this._failed = false;
		this._failedError = null;
		this._finalized = false;
		this._attrs = [];
		this._goals = [];
		this._exposures = [];
		// No prototype, so a name such as `constructor` or `__proto__` is an ordinary key. `_units` stays a
		// plain object because `getUnits()` returns it, as in 1.13.4; its keys are written and read as own
		// properties instead.
		this._overrides = Object.create(null);
		this._cassignments = Object.create(null);
		this._units = {};
		this._assigners = Object.create(null);
		this._holdoutAssignments = {};
		this._audienceMatcher = new AudienceMatcher();
		this._environmentName = null;
		this._attrsSeq = 0;
		this._attrsMapCache = null;
		this._attrsMapCacheSeq = -1;
		this._switchbackGenerations = 0;

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

	readyError(): Error | null {
		return this._failedError;
	}

	ready(): Promise<unknown> {
		if (this.isReady()) {
			return Promise.resolve(true);
		}

		return this._promise?.then(() => true) ?? Promise.resolve(true);
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
		return hasOwn(this._units, unitType) ? this._units[unitType] : undefined;
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

		const previous = this.getUnit(unitType);
		if (previous !== undefined && previous !== uid) {
			throw new Error(`Unit '${unitType}' UID already set.`);
		}

		// Defined, not assigned: assigning `__proto__` would replace the map's prototype.
		Object.defineProperty(this._units, unitType, { value: uid, enumerable: true, writable: true, configurable: true });

		this._invalidateAssignmentsPinnedWithMissingUnit(unitType);
	}

	// A null holdout entry or a split rule resolved without its unit means the unit was missing when
	// the assignment was resolved. Evict so `_assign()` rebuilds it; already-exposed ones are kept
	// since re-resolving would queue a second, conflicting exposure.
	private _invalidateAssignmentsPinnedWithMissingUnit(unitType: string): void {
		const epochs = this._switchbackEpochs;
		if (epochs !== undefined) {
			for (const experimentName in epochs) {
				const slots = epochs[experimentName].slots;
				// Period indices stay retained, as in Java's invalidateAssignmentsPinnedWithMissingUnit.
				for (const period in slots) {
					if (this._isSwitchbackSlotWithoutUnit(slots[period])) delete slots[period];
				}
				const periodless = epochs[experimentName].periodless;
				if (periodless !== undefined && this._isSwitchbackSlotWithoutUnit(periodless)) {
					delete epochs[experimentName].periodless;
				}
			}
		}

		for (const experimentName in this._assignments) {
			const assignment = this._assignments[experimentName];
			if (assignment.unitType !== unitType || assignment.exposed) continue;

			const hasMissingHoldoutEntry = assignment.holdoutAssignments?.some(
				(holdoutAssignment) => holdoutAssignment === null
			);

			if (hasMissingHoldoutEntry || assignment.isRuleMissingUnit) {
				delete this._assignments[experimentName];
			}
		}
	}

	// A switchback resolved with no linked unit set is resolved again once one may be. Unless overridden
	// it published nothing, so it is dropped even when exposed.
	private _isSwitchbackSlotWithoutUnit(assignment: Assignment): boolean {
		return (
			assignment.switchbackServing?.status === SWITCHBACK_ABSENT && (!assignment.overridden || !assignment.exposed)
		);
	}

	getUnits(): Units {
		return this._units;
	}

	units(units: Record<string, number | string>) {
		for (const [unitType, uid] of Object.entries(units)) {
			this.unit(unitType, uid);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	getAttribute(attrName: string): any {
		for (let i = this._attrs.length - 1; i >= 0; i--) {
			if (this._attrs[i].name === attrName) return this._attrs[i].value;
		}
		return undefined;
	}

	attribute(attrName: string, value: unknown) {
		this._checkNotFinalized();

		this._attrs.push({ name: attrName, value: value, setAt: Date.now() });
		this._attrsSeq++;
	}

	getAttributes() {
		const attributes: Record<string, unknown> = {};
		// forEach, as in 1.13.4: measurably faster on long attribute histories than for...of or an index loop.
		this._attrs.forEach((attr) => {
			attributes[attr.name] = attr.value;
		});
		return attributes;
	}

	attributes(attrs: Record<string, unknown>) {
		for (const [attrName, value] of Object.entries(attrs)) {
			this.attribute(attrName, value);
		}
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

	// Declared as in 1.13.4 so existing `=== true` checks still compile; it only ever returns a promise.
	finalize(requestOptions?: ClientRequestOptions): true | Promise<void> {
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

		// defineProperty keeps a key such as "__proto__" an own entry of the returned plain object.
		for (const [key, values] of Object.entries(this._indexVariables)) {
			Object.defineProperty(variableExperiments, key, {
				value: values.map((value) => value.data.name),
				enumerable: true,
				writable: true,
				configurable: true,
			});
		}

		return variableExperiments;
	}

	override(experimentName: string, variant: number) {
		// Deliberately allowed after finalize() — not guarded by
		// _checkNotFinalized(), unlike track()/treatment()/etc. This is the
		// canonical cross-SDK behavior for this SDK: see cross-sdk-tests
		// scenario "190 - Post-Finalize - override() Allowed (Verified Finalized)".
		this._overrides = Object.assign(this._overrides, { [experimentName]: variant });
	}

	overrides(experimentVariants: Record<string, number>) {
		for (const [experimentName, variant] of Object.entries(experimentVariants)) {
			this.override(experimentName, variant);
		}
	}

	customAssignment(experimentName: string, variant: number) {
		this._checkNotFinalized();

		this._cassignments[experimentName] = variant;
	}

	customAssignments(experimentVariants: Record<string, number>) {
		for (const [experimentName, variant] of Object.entries(experimentVariants)) {
			this.customAssignment(experimentName, variant);
		}
	}

	getSDK(): SDK {
		return this._sdk;
	}

	getOptions(): ContextOptions {
		return { ...this._opts };
	}

	private _checkNotFinalized() {
		if (this.isFinalized()) {
			throw new Error("ABSmartly Context is finalized.");
		} else if (this.isFinalizing()) {
			throw new Error("ABSmartly Context is finalizing.");
		}
	}

	// A split rule randomizes over `unitType`: the experiment's own, or a switchback's serving unit.
	private _resolveRule(
		entry: Experiment,
		attrs: Record<string, unknown>,
		isUnitPinnedMissing: boolean,
		unitType: string | null = entry.data.unitType
	) {
		const experiment = entry.data;
		const variantCount = experiment.variants.length;
		if (entry.rules === undefined) {
			entry.rules = this._audienceMatcher.parseRules(experiment.assignmentRules ?? "");
		}
		if (entry.rules == null) return null;

		const action = this._audienceMatcher.evaluateParsedRules(entry.rules, this._environmentName, attrs);
		if (action == null) return null;

		if ("variant" in action) {
			const isInBounds = action.variant >= 0 && action.variant < variantCount;
			return isInBounds ? { variant: action.variant, isMissingUnit: false } : null;
		}
		if (action.split.length !== variantCount) return null;

		const unit = unitType != null && !isUnitPinnedMissing ? this._unitHash(unitType) : null;
		if (unitType == null || unit === null) return { variant: experiment.fullOnVariant, isMissingUnit: true };

		const assigner =
			unitType in this._assigners ? this._assigners[unitType] : (this._assigners[unitType] = new VariantAssigner(unit));
		return { variant: assigner.assign(action.split, experiment.seedHi, experiment.seedLo), isMissingUnit: false };
	}

	private _checkReady(expectNotFinalized?: boolean) {
		if (!this.isReady()) {
			throw new Error("ABSmartly Context is not yet ready.");
		}

		if (expectNotFinalized) {
			this._checkNotFinalized();
		}
	}

	// Non-empty `application` and `environment` names from the client config, which the collector also
	// attaches to every exposure server-side, so audiences and rule conditions can target them.
	private _getSystemAttributes(): Record<string, string> {
		const client = this._sdk.getClient();
		const systemAttrs: Record<string, string> = {};
		// A custom `client` passed to the SDK may predate either getter.
		const applicationName = typeof client?.getApplication === "function" ? client.getApplication()?.name : undefined;
		if (typeof applicationName === "string" && applicationName.length > 0) {
			systemAttrs["application"] = applicationName;
		}
		const environmentName = typeof client?.getEnvironment === "function" ? client.getEnvironment() : undefined;
		if (typeof environmentName === "string" && environmentName.length > 0) {
			systemAttrs["environment"] = environmentName;
		}
		return systemAttrs;
	}

	// System attributes first, then user attributes on top, so a user-set value always wins, even one set
	// after an assignment was cached (the `_attrsSeq` bump invalidates it).
	private _getAttributesMap(): Record<string, unknown> {
		if (this._attrsMapCache !== null && this._attrsMapCacheSeq === this._attrsSeq) {
			return this._attrsMapCache;
		}
		const attrs: Record<string, unknown> = this._getSystemAttributes();
		// forEach, as in 1.13.4: measurably faster here than the compiled for...of or an index loop.
		this._attrs.forEach((attr) => {
			attrs[attr.name] = attr.value;
		});
		this._attrsMapCache = attrs;
		this._attrsMapCacheSeq = this._attrsSeq;
		return attrs;
	}

	private _evaluateAudience(audience: string): boolean | null {
		try {
			return this._audienceMatcher.evaluate(audience, this._getAttributesMap());
		} catch (error) {
			this._logError(error as Error);
			return false;
		}
	}

	// `now` is the clock reading a switchback resolves its period at; read here when not given.
	private _assign(experimentName: string, now?: number): Assignment {
		const experimentMatches = (experiment: ExperimentData, assignment: Assignment) => {
			return (
				experiment.id === assignment.id &&
				experiment.unitType === assignment.unitType &&
				experiment.iteration === assignment.iteration &&
				experiment.fullOnVariant === assignment.fullOnVariant &&
				arrayEqualsShallow(experiment.trafficSplit, assignment.trafficSplit)
			);
		};

		const audienceMatches = (entry: Experiment, assignment: Assignment) => {
			const experiment = entry.data;
			const ruleKey = entry.ruleKey ?? "";
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
				if (entry.ruleKey) {
					// Built only when there are rules: the no-rule path must not rebuild the attribute map
					// after every setAttribute (1.13.4 never built it there).
					const attrs = this._getAttributesMap();
					// An exposed split resolved without its unit keeps resolving as if the unit were still
					// missing, so a unit set afterwards cannot switch the variant the user already saw.
					const isUnitPinnedMissing = assignment.exposed && assignment.isRuleMissingUnit === true;
					const rule = this._resolveRule(entry, attrs, isUnitPinnedMissing);
					const ruleVariant = rule?.variant ?? null;
					if (ruleVariant !== (assignment.ruleVariant ?? null)) {
						return false;
					}

					assignment.ruleVariant = ruleVariant;
					assignment.isRuleMissingUnit = rule?.isMissingUnit ?? false;
				}

				if (!assignment.ruleOverride && experiment.audience && experiment.audience.length > 0) {
					const result = this._evaluateAudience(experiment.audience);
					// As in 1.13.4, an indeterminate (null) result counts as a match, so a cached mismatch is
					// rebuilt and the unit gets what a fresh context with the same attributes would.
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

		// (id, iteration) only: seed/split edits must not force a duplicate exposure.
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

		if (this._switchbackEpochs !== undefined) {
			this._dropStaleSwitchbackEpoch(experimentName, experiment);
		}
		if (experiment != null && experiment.switchback !== undefined) {
			return this._assignSwitchback(experimentName, experiment, now ?? Date.now());
		}

		if (experimentName in this._assignments) {
			const assignment = this._assignments[experimentName];
			if (
				!assignment.exposed &&
				assignment.unitType != null &&
				(assignment.isRuleMissingUnit || assignment.holdoutAssignments?.some((item) => item === null)) &&
				hasOwn(this._units, assignment.unitType)
			) {
				delete this._assignments[experimentName];
				return this._assign(experimentName);
			}
			if (hasOverride) {
				if (
					assignment.overridden &&
					assignment.variant === this._overrides[experimentName] &&
					(experiment == null || holdoutSetMatches(experiment, assignment))
				) {
					// override up-to-date
					return assignment;
				}
			} else if (experiment == null) {
				// A rule-won assignment is not "assigned" either, but its variant came from the
				// experiment's rules, so it must be rebuilt once the experiment is gone.
				if (!assignment.assigned && !assignment.ruleOverride) {
					// previously not-running experiment
					return assignment;
				}
			} else if (
				assignment.suppressed ||
				assignment.ruleOverride ||
				!hasCustom ||
				this._cassignments[experimentName] === assignment.variant
			) {
				// Suppressed assignments are forced to variant 0 and a matching rule wins over a custom
				// assignment, so a custom mismatch is not staleness.
				if (
					experimentMatches(experiment.data, assignment) &&
					audienceMatches(experiment, assignment) &&
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
			assignment.variant = this._overrides[experimentName];
		} else {
			if (experiment != null) {
				const unitType = experiment.data.unitType;

				// Set even when suppressed, or `audienceMatches` rebuilds (losing `exposed`) on every call.
				assignment.ruleKey = experiment.ruleKey ?? "";

				const rule = experiment.ruleKey ? this._resolveRule(experiment, this._getAttributesMap(), false) : null;
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

						if (typeof result === "boolean") {
							assignment.audienceMismatch = !result;
						}
					}

					if (experiment.data.audienceStrict && assignment.audienceMismatch) {
						assignment.variant = 0;
					} else if (experiment.data.fullOnVariant === 0) {
						if (unitType !== null) {
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
					} else {
						assignment.assigned = true;
						assignment.eligible = true;
						assignment.variant = experiment.data.fullOnVariant;
						assignment.fullOn = true;
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

	// Port of java-sdk's switchback branch of getAssignment (the Collector's ContextAPI, R33). The
	// serving unit and cluster key decide whether the experiment applies and under which unit; for an
	// eligible cluster the precedence is override, assignment rule (a split randomizes over the
	// serving unit), strict audience mismatch (recorded), full-on, no period (silent control), traffic
	// on the serving unit's hash (a miss is recorded), custom assignment, then the schedule draw over
	// the raw cluster key. Holdouts never apply.
	private _assignSwitchback(experimentName: string, experiment: Experiment, now: number): Assignment {
		const switchback = experiment.switchback as { generation: number; sources: SwitchbackSources | null };
		const data = experiment.data;
		const periodIndex = switchback.sources !== null ? switchbackPeriodIndex(data, now) : null;
		// Own properties only: an experiment can be named like an Object member (`constructor`).
		const hasOverride = Object.prototype.hasOwnProperty.call(this._overrides, experimentName);
		const custom = Object.prototype.hasOwnProperty.call(this._cassignments, experimentName)
			? this._cassignments[experimentName]
			: undefined;

		// `_assign` dropped the slots of any earlier generation, so a slot found here is current.
		const epoch = this._switchbackEpochs?.[experimentName];
		const current = periodIndex === null ? epoch?.periodless : epoch?.slots[periodIndex];
		if (current !== undefined && this._isSwitchbackAssignmentCurrent(experiment, current, hasOverride, custom)) {
			return current;
		}

		const assignment: Assignment = {
			id: data.id,
			iteration: data.iteration,
			fullOnVariant: data.fullOnVariant,
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
			trafficSplit: data.trafficSplit,
			attrsSeq: this._attrsSeq,
			switchbackGeneration: switchback.generation,
			switchbackCustom: custom,
		};

		// Within one period slot the serving unit and cluster key are read once: a slot rebuilt in the
		// same epoch, e.g. after an attribute change flipped the audience, keeps its cluster.
		const cachedServing = current?.switchbackServing;
		const serving =
			cachedServing !== undefined && cachedServing.status !== SWITCHBACK_ABSENT
				? cachedServing
				: this._resolveSwitchbackServing(experiment, now);
		assignment.switchbackServing = serving;
		assignment.unitType =
			serving.unitType ?? (switchback.sources !== null ? switchback.sources.types[0] : data.unitType);

		if (hasOverride) {
			assignment.overridden = true;
			assignment.variant = this._overrides[experimentName];
		} else {
			this._resolveSwitchbackVariant(experiment, assignment, serving, periodIndex, custom);
		}

		if (assignment.variant < data.variants.length) {
			assignment.variables = experiment.variables[assignment.variant];
		}

		this._retainSwitchbackSlot(experimentName, switchback.generation, periodIndex, assignment);
		return assignment;
	}

	private _resolveSwitchbackVariant(
		experiment: Experiment,
		assignment: Assignment,
		serving: SwitchbackServing,
		periodIndex: number | null,
		custom: number | undefined
	) {
		const data = experiment.data;
		if (serving.status === SWITCHBACK_ABSENT) {
			// No linked unit: the experiment does not apply, like an unset unit type.
			assignment.eligible = false;
			assignment.switchbackSilent = true;
			return;
		}

		assignment.assigned = true;
		if (serving.status === SWITCHBACK_INELIGIBLE) {
			// No rule, audience or full-on is evaluated for an ineligible cluster.
			assignment.eligible = false;
			assignment.switchbackSilent = true;
			return;
		}

		assignment.ruleKey = data.assignmentRules ? `${data.assignmentRules}:${this._environmentName}` : "";
		const rule =
			data.assignmentRules && data.assignmentRules.length > 0
				? this._resolveRule(experiment, this._getAttributesMap(), false, serving.unitType)
				: null;
		assignment.ruleVariant = rule?.variant ?? null;
		assignment.isRuleMissingUnit = rule?.isMissingUnit ?? false;
		if (rule !== null) {
			// Recorded like a unit experiment's rule win: ruleOverride set, not "assigned".
			assignment.assigned = false;
			assignment.ruleOverride = true;
			assignment.variant = rule.variant;
			return;
		}

		if (data.audience && data.audience.length > 0) {
			const result = this._evaluateAudience(data.audience);
			if (typeof result === "boolean") {
				assignment.audienceMismatch = !result;
			}
		}
		if (data.audienceStrict && assignment.audienceMismatch) {
			// Recorded like a unit experiment's strict mismatch: control, not "assigned".
			assignment.assigned = false;
			return;
		}
		if (data.fullOnVariant !== 0) {
			assignment.variant = data.fullOnVariant;
			assignment.fullOn = true;
			return;
		}
		if (periodIndex === null) {
			// Before the anchor or with an unservable schedule there is no draw: control, no exposure.
			assignment.eligible = false;
			assignment.switchbackSilent = true;
			return;
		}

		const unitType = serving.unitType as string;
		const unit = this._unitHash(unitType) as string;
		const assigner =
			unitType in this._assigners ? this._assigners[unitType] : (this._assigners[unitType] = new VariantAssigner(unit));
		if (assigner.assign(data.trafficSplit, data.trafficSeedHi, data.trafficSeedLo) !== 1) {
			// A traffic miss on an eligible cluster is recorded, as for a unit experiment.
			assignment.eligible = false;
			return;
		}
		if (custom !== undefined) {
			assignment.variant = custom;
			assignment.custom = true;
			return;
		}
		assignment.variant = assignSwitchbackPeriod(
			serving.clusterKey as string,
			periodIndex,
			data.seedHi,
			data.seedLo,
			data.split.length
		);
	}

	// Revalidates a cached slot of the current generation. Like the unit path, a rule or audience
	// re-evaluation that keeps the outcome advances the slot's stamps in place.
	private _isSwitchbackAssignmentCurrent(
		experiment: Experiment,
		assignment: Assignment,
		hasOverride: boolean,
		custom: number | undefined
	): boolean {
		if (hasOverride) {
			return assignment.overridden && assignment.variant === this._overrides[experiment.data.name];
		}

		const data = experiment.data;
		if (
			assignment.overridden ||
			assignment.fullOnVariant !== data.fullOnVariant ||
			!arrayEqualsShallow(assignment.trafficSplit, data.trafficSplit) ||
			(!assignment.ruleOverride && assignment.switchbackCustom !== custom)
		) {
			return false;
		}

		// A slot without an eligible cluster never consulted its rules or audience.
		if (assignment.switchbackServing?.status !== SWITCHBACK_ELIGIBLE) return true;

		const ruleKey = data.assignmentRules ? `${data.assignmentRules}:${this._environmentName}` : "";
		if (ruleKey === assignment.ruleKey && this._attrsSeq <= (assignment.attrsSeq ?? 0)) return true;

		const rule =
			data.assignmentRules && data.assignmentRules.length > 0
				? this._resolveRule(experiment, this._getAttributesMap(), false, assignment.unitType)
				: null;
		if ((rule?.variant ?? null) !== (assignment.ruleVariant ?? null)) return false;

		if (!assignment.ruleOverride && data.audience && data.audience.length > 0) {
			// An indeterminate result counts as a match, as on a fresh assignment, so a cached slot and a
			// fresh context with the same attributes serve the same arm.
			const result = this._evaluateAudience(data.audience);
			const audienceMismatch = typeof result === "boolean" ? !result : false;
			if (audienceMismatch !== assignment.audienceMismatch) return false;
		}

		assignment.isRuleMissingUnit = rule?.isMissingUnit ?? false;
		assignment.ruleKey = ruleKey;
		assignment.attrsSeq = this._attrsSeq;
		return true;
	}

	// The Collector's switchbackServing at `now`. A missing, empty or unreadable cluster map takes the
	// legacy path: an ineligible control under a unit of the declared unitType, if one is set.
	private _resolveSwitchbackServing(experiment: Experiment, now: number): SwitchbackServing {
		const sources = (experiment.switchback as { sources: SwitchbackSources | null }).sources;
		if (sources === null) return legacySwitchbackServing(experiment.data.unitType, this._units);

		return resolveSwitchbackServing(
			sources.types,
			sources.paths,
			experiment.data.switchbackClusterValues,
			this._units,
			(path) => {
				// The attribute the Collector reads at `now`: among those named by the path's first segment
				// and set at or before now, the latest setAt wins, and on a tie the one set last.
				let selected: Attribute | null = null;
				for (const attr of this._attrs) {
					if (
						attr.setAt <= now &&
						typeof attr.name === "string" &&
						attr.name.trim() === path.keys[0] &&
						(selected === null || attr.setAt >= selected.setAt)
					) {
						selected = attr;
					}
				}
				return selected !== null ? resolveSwitchbackPath(path, selected.value) : null;
			}
		);
	}

	// Drops every slot of an experiment's switchback epoch once the installed definition is gone, is not
	// a switchback or carries another generation.
	private _dropStaleSwitchbackEpoch(experimentName: string, experiment: Experiment | null) {
		const epochs = this._switchbackEpochs as Record<string, SwitchbackEpoch>;
		const epoch = epochs[experimentName];
		if (epoch === undefined || experiment?.switchback?.generation === epoch.generation) return;

		// A unit assignment cached before the experiment became a switchback must not outlive the stint.
		delete this._assignments[experimentName];
		delete epochs[experimentName];
	}

	// Installs a slot in the experiment's epoch. At most
	// SWITCHBACK_RETAINED_PERIODS period slots are kept per experiment, evicting the lowest index other
	// than the one just installed. Re-entering an evicted period (a clock moved back by two or more
	// periods) resolves and exposes it once more.
	private _retainSwitchbackSlot(
		experimentName: string,
		generation: number,
		periodIndex: number | null,
		assignment: Assignment
	) {
		// No prototype, so an experiment named like an Object member (`constructor`) has no epoch yet.
		const epochs =
			this._switchbackEpochs ?? (this._switchbackEpochs = Object.create(null) as Record<string, SwitchbackEpoch>);
		const epoch =
			epochs[experimentName] ?? (epochs[experimentName] = { generation, periods: [], slots: Object.create(null) });
		if (periodIndex === null) {
			epoch.periodless = assignment;
			return;
		}

		epoch.slots[periodIndex] = assignment;
		if (epoch.periods.indexOf(periodIndex) >= 0) return;
		epoch.periods.push(periodIndex);
		while (epoch.periods.length > SWITCHBACK_RETAINED_PERIODS) {
			let evicted = -1;
			for (let i = 0; i < epoch.periods.length; ++i) {
				if (epoch.periods[i] !== periodIndex && (evicted < 0 || epoch.periods[i] < epoch.periods[evicted])) {
					evicted = i;
				}
			}
			delete epoch.slots[epoch.periods[evicted]];
			epoch.periods.splice(evicted, 1);
		}
	}

	// The whole call is one deferral scope, so an error logged while assigning (a throwing audience)
	// reaches the eventLogger only after the call's exposures are queued.
	private _treatment(experimentName: string) {
		if (this._deferringLogs) return this._treatmentInScope(experimentName);
		this._deferringLogs = true;
		try {
			return this._treatmentInScope(experimentName);
		} finally {
			this._endDeferral();
		}
	}

	private _treatmentInScope(experimentName: string) {
		const now = this._switchbackClock(experimentName, undefined);
		const assignment = this._assign(experimentName, now);

		if (!assignment.exposed) {
			assignment.exposed = true;
			this._triggerExposures(experimentName, assignment, now);
		}

		return assignment;
	}

	// One clock reading per call, taken only when the experiment is a switchback (or `now` is
	// already set): unit experiments keep reading the clock when their exposure is queued.
	private _switchbackClock(experimentName: string, now: number | undefined): number | undefined {
		if (now !== undefined || this._switchbackGenerations === 0) return now;
		const experiment = experimentName in this._index ? this._index[experimentName] : null;
		return experiment != null && experiment.switchback !== undefined ? Date.now() : undefined;
	}

	// A switchback exposure is stamped with `now`, the reading that selected its period, since analysis
	// derives the period from `exposedAt`; a later reading could fall in the next period. Holdouts
	// never apply to a switchback, so its assignment has none to trigger.
	private _triggerExposures(experimentName: string, assignment: Assignment, now?: number, withHoldouts = true): void {
		if (assignment.switchbackGeneration !== undefined) {
			if (!assignment.switchbackSilent) {
				this._queueExposure(experimentName, assignment, now);
			}
			return;
		}

		if (!assignment.suppressed || assignment.overridden || assignment.ruleOverride) {
			this._queueExposure(experimentName, assignment);
		}

		if (withHoldouts) this._triggerApplicableHoldoutExposures(assignment);
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

				this._queueExposure(holdouts[i].data.name, holdoutAssignment);
			}
		});
	}

	private _queueExposure(experimentName: string, assignment: Assignment, exposedAt?: number) {
		const exposureEvent: Exposure = {
			id: assignment.id,
			name: experimentName,
			exposedAt: exposedAt ?? Date.now(),
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

		if (this._deferringLogs) {
			(this._deferredLogs ??= []).push(["exposure", exposureEvent]);
			return;
		}

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

	// Mirrors java-sdk Context.getVariableAssignment. Candidates define the key in any variant, in
	// experiment-id order. The first one the unit is actually in (assigned, overridden or
	// rule-assigned) wins regardless of its arm; otherwise the first held-out candidate supplies
	// its control value. Only the winner gets an exposure, so a unit is never recorded in an
	// experiment it only got checked against. Like Java, each visited candidate's applicable
	// holdouts still fire on the non-peek path.
	private _resolveVariableValue(key: string, defaultValue: string, shouldQueueExposure: boolean): string {
		const candidates = this._indexVariables[key];
		if (!Array.isArray(candidates)) return defaultValue;

		// Plain locals rather than tuples: this is a hot path and must not allocate per read.
		let selectedName = "";
		let selected: Assignment | undefined;
		let now: number | undefined;

		// Indexed loop: a for...of here compiles to a larger body that slows every warmed read.
		for (let i = 0; i < candidates.length; i++) {
			const experimentName = candidates[i].data.name;
			now = this._switchbackClock(experimentName, now);
			const assignment = this._assign(experimentName, now);
			if (shouldQueueExposure) this._triggerApplicableHoldoutExposures(assignment);

			if (assignment.assigned || assignment.overridden || assignment.ruleOverride) {
				selectedName = experimentName;
				selected = assignment;
				break;
			}

			if (assignment.suppressed && selected === undefined) {
				selectedName = experimentName;
				selected = assignment;
			}
		}

		if (selected === undefined) return defaultValue;

		if (shouldQueueExposure && !selected.exposed) {
			selected.exposed = true;

			this._triggerExposures(selectedName, selected, now, false);
		}

		// A missing key (or out-of-range arm) returns the caller's default, never a later
		// experiment's value: falling through by arm would bias the winning experiment.
		const variables = selected.variables;
		return variables !== undefined && key in variables ? (variables[key] as string) : defaultValue;
	}

	// A user eventLogger may call finalize() or publish(). Exposure and error callbacks this read
	// triggers run only after every exposure of the read (candidates' holdouts and the winner) is
	// queued, so such a call sends all of them instead of sealing the context with one pending.
	// The replay lives in its own method so a warmed read, which defers nothing, stays small.
	private _variableValue(key: string, defaultValue: string): string {
		if (this._deferringLogs) return this._resolveVariableValue(key, defaultValue, true);
		this._deferringLogs = true;
		try {
			return this._resolveVariableValue(key, defaultValue, true);
		} finally {
			this._endDeferral();
		}
	}

	// Ends a deferral scope, replaying held callbacks in queue order. Deferral stays on while
	// replaying, so a nested read or treatment() made from a callback appends its own callbacks
	// behind the ones already queued.
	private _endDeferral() {
		if (this._deferredLogs === undefined) this._deferringLogs = false;
		else if (this._replayExhausted) this._deliverDeferredLogs();
		else this._replayDeferredLogs();
	}

	// A callback that keeps feeding new events would drain forever (or grow the queue without
	// bound), so once a replay has run DEFERRED_REPLAY_ROUNDS rounds or delivered
	// DEFERRED_REPLAY_CALLBACKS callbacks, it stops queueing rounds: each later call still holds
	// its own callbacks until all of its exposures are queued, then delivers that batch at once,
	// bounded by the call stack as before deferral existed.
	private _replayDeferredLogs() {
		let exposed = false;
		let rounds = 0;
		let delivered = 0;
		try {
			let deferred: [EventName, Record<string, unknown> | Error][] | undefined = this._deferredLogs;
			while (deferred !== undefined) {
				this._deferredLogs = undefined;
				if (++rounds >= DEFERRED_REPLAY_ROUNDS) {
					this._deferringLogs = false;
					this._replayExhausted = true;
				}
				for (let i = 0; i < deferred.length; i++) {
					// Counted as delivered, so callbacks already waiting keep queue order up to the limit.
					const cutoff = ++delivered >= DEFERRED_REPLAY_CALLBACKS;
					let remainder: [EventName, Record<string, unknown> | Error][] | undefined;
					if (cutoff) {
						// Deferral ends with this callback, so a read it makes is delivered inline before it
						// returns, as in 1.13.4. The rest of the batch follows: this round's waiting callbacks,
						// then those its earlier callbacks queued for the next round.
						this._deferringLogs = false;
						this._replayExhausted = true;
						remainder = deferred.slice(i + 1).concat(this._deferredLogs ?? []);
						this._deferredLogs = undefined;
					}
					if (deferred[i][0] === "exposure") exposed = true;
					this._logEvent(deferred[i][0], deferred[i][1]);
					if (remainder !== undefined) {
						if (remainder.length > 0) {
							this._deferredLogs = remainder;
							this._deliverDeferredLogs();
						}
						break;
					}
				}
				deferred = this._deferredLogs;
			}
		} finally {
			this._deferringLogs = false;
			this._replayExhausted = false;
			// Only exposures need publishing; an error alone must not arm the timer.
			if (exposed && this._pending > 0) this._setTimeout();
		}
	}

	private _deliverDeferredLogs() {
		const deferred = this._deferredLogs as [EventName, Record<string, unknown> | Error][];
		this._deferredLogs = undefined;
		this._deferringLogs = false;
		let exposed = false;
		try {
			for (let i = 0; i < deferred.length; i++) {
				if (deferred[i][0] === "exposure") exposed = true;
				this._logEvent(deferred[i][0], deferred[i][1]);
			}
		} finally {
			if (exposed && this._pending > 0) this._setTimeout();
		}
	}

	private _peekVariable(key: string, defaultValue: string): string {
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
					// _flush already logs publish errors via the callback.
					this._flush();
				}, this._opts.publishDelay);
			}
		}
	}

	// The collector only applies attributes with setAt <= an event's time and picks the latest setAt
	// among duplicates, so system attributes are stamped with the earliest event in the batch and left
	// out when the user set the same name.
	private _buildAttributes(systemSetAt: number): Attribute[] {
		// Built with map(), as 1.13.4 did; pushing one element at a time is measurably slower here.
		if (this._opts.includeSystemAttributes !== true) {
			return this._attrs.map((x) => ({ name: x.name, value: x.value, setAt: x.setAt }));
		}

		let userSetSdkName = false;
		let userSetSdkVersion = false;
		const userAttributes = this._attrs.map((x) => {
			if (x.name === "sdk_name") userSetSdkName = true;
			else if (x.name === "sdk_version") userSetSdkVersion = true;
			return { name: x.name, value: x.value, setAt: x.setAt };
		});

		const client = this._sdk.getClient();
		const systemAttributes: Attribute[] = [];
		const agent = typeof client?.getAgent === "function" ? client.getAgent() : undefined;
		if (!userSetSdkName && typeof agent === "string" && agent.length > 0) {
			systemAttributes.push({ name: "sdk_name", value: agent, setAt: systemSetAt });
		}
		if (!userSetSdkVersion) systemAttributes.push({ name: "sdk_version", value: SDK_VERSION, setAt: systemSetAt });
		return systemAttributes.length === 0 ? userAttributes : systemAttributes.concat(userAttributes);
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

			let systemSetAt = request.publishedAt;
			if (this._opts.includeSystemAttributes === true) {
				for (const x of this._exposures) systemSetAt = Math.min(systemSetAt, x.exposedAt);
				for (const x of this._goals) systemSetAt = Math.min(systemSetAt, x.achievedAt);
			}
			const allAttributes = this._buildAttributes(systemSetAt);
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

		let publishResult: Promise<void>;
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
		// promise. `.finally()` is avoided (not part of the ES6 Promise contract
		// the documented IE 10 target relies on a polyfill for).
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

	private _logEvent(eventName: EventName, data?: Record<string, unknown> | Error) {
		if (this._eventLogger) {
			// A throwing custom eventLogger must never propagate out of this method:
			// every call site treats logging as a side effect, and letting an
			// observer exception escape here has repeatedly corrupted unrelated
			// control flow (e.g. turning a successful init into a "failed" one when
			// this call sits inside a .then() immediately followed by .catch(),
			// or stranding a promise whose settlement was supposed to happen right
			// after this call).
			try {
				this._eventLogger(this, eventName, data);
			} catch (observerError) {
				console.error(observerError);
			}
		}
	}

	private _logError(error: Error) {
		if (this._deferringLogs) {
			(this._deferredLogs ??= []).push(["error", error]);
			return;
		}
		this._logEvent("error", error);
	}

	private _unitHash(unitType: string) {
		if (!this._hashes) {
			this._hashes = Object.create(null) as Record<string, string | null>;
		}

		if (!(unitType in this._hashes)) {
			// Never cache `null`: the unit can still be set later (see `_getHoldoutAssignment`).
			if (!hasOwn(this._units, unitType)) {
				return null;
			}

			const hash = hashUnit(this._units[unitType]);
			this._hashes[unitType] = hash;
			return hash;
		}

		return this._hashes[unitType];
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

	private _init(data: ContextData, assignments: Record<string, Assignment> = Object.create(null)) {
		this._data = data;
		const client = this._sdk.getClient();
		this._environmentName = typeof client?.getEnvironment === "function" ? client.getEnvironment() ?? null : null;

		const index: Record<string, Experiment> = Object.create(null);
		const indexVariables: Record<string, Experiment[]> = {};

		const holdoutsById: Record<number, HoldoutData> = {};

		(data.holdouts || []).forEach((holdout) => {
			if (holdout.split && holdout.split.length > 0) {
				holdoutsById[holdout.id] = holdout;
			}
		});

		this._holdoutsById = holdoutsById;

		const holdoutExperiments: Record<number, HoldoutExperiment> = {};

		const resolveHoldoutExperiment = (holdoutId: number): HoldoutExperiment | undefined => {
			if (holdoutExperiments[holdoutId]) {
				return holdoutExperiments[holdoutId];
			}

			const holdoutData = this._holdoutsById[holdoutId];
			if (!holdoutData) {
				return undefined;
			}

			const holdoutEntry: HoldoutExperiment = {
				data: holdoutData,
			};

			holdoutExperiments[holdoutId] = holdoutEntry;
			return holdoutEntry;
		};

		(data.experiments || []).forEach((experiment) => {
			const variables: Record<string, unknown>[] = [];

			let holdouts: HoldoutExperiment[] | null = null;
			if (experiment.holdoutIds && experiment.holdoutIds.length > 0) {
				const resolved: HoldoutExperiment[] = [];

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
				ruleKey:
					typeof experiment.assignmentRules === "string" && experiment.assignmentRules
						? `${experiment.assignmentRules}:${this._environmentName}`
						: "",
			};

			if (experiment.randomizationType === "switchback") {
				const sources = switchbackSources(experiment.switchbackClusters);
				const previous = this._index?.[experiment.name]?.switchback;
				const keepsGeneration =
					previous !== undefined &&
					sameSwitchbackIdentity(
						this._index[experiment.name].data,
						previous.sources !== null,
						experiment,
						sources !== null
					);
				entry.switchback = {
					generation: keepsGeneration ? previous.generation : ++this._switchbackGenerations,
					sources,
				};
			}

			index[experiment.name] = entry;

			let hasPrototypeVariable = false;
			for (let i = 0; i < experiment.variants.length; i++) {
				const variant = experiment.variants[i];
				const config = variant.config;
				let parsed: Record<string, unknown> = {};

				if (config != null && config.length > 0) {
					try {
						const value = JSON.parse(config);
						if (isObject(value)) {
							parsed = value;
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
					if (key in Object.prototype) hasPrototypeVariable = true;
					const value = entry;
					if (Array.isArray(indexVariables[key])) {
						insertUniqueSorted(
							indexVariables[key],
							value,
							(a, b) => (a as Experiment).data.id < (b as Experiment).data.id
						);
					} else {
						Object.defineProperty(indexVariables, key, {
							value: [value],
							enumerable: true,
							writable: true,
							configurable: true,
						});
					}
				}

				variables[i] = parsed;
			}

			// Only experiments defining a prototype-named key need dictionary configs. Classify at
			// indexing time so ordinary variable reads retain their existing fast membership check.
			if (hasPrototypeVariable) {
				for (let i = 0; i < variables.length; i++) {
					variables[i] = Object.assign(Object.create(null), variables[i]);
				}
			}
		});

		// A reused assignment (or switchback slot) still points at the previous parse of its configs;
		// if a refresh made the experiment prototype-keyed, cached variables must not resolve inherited
		// members.
		const prototypeKeyed = (experimentName: string) => {
			// Own lookup: an experiment named like an Object.prototype member must not resolve one.
			const experiment = Object.prototype.hasOwnProperty.call(index, experimentName)
				? index[experimentName]
				: undefined;
			return experiment !== undefined && Object.getPrototypeOf(experiment.variables[0] ?? {}) === null;
		};
		const reclassify = (assignment: Assignment | undefined) => {
			const variables = assignment?.variables;
			if (assignment !== undefined && variables !== undefined && Object.getPrototypeOf(variables) !== null) {
				assignment.variables = Object.assign(Object.create(null), variables);
			}
		};
		for (const experimentName of Object.keys(assignments)) {
			if (prototypeKeyed(experimentName)) reclassify(assignments[experimentName]);
		}
		const epochs = this._switchbackEpochs;
		if (epochs !== undefined) {
			for (const experimentName of Object.keys(epochs)) {
				if (!prototypeKeyed(experimentName)) continue;
				const epoch = epochs[experimentName];
				reclassify(epoch.periodless);
				for (const period of epoch.periods) reclassify(epoch.slots[period]);
			}
		}

		// A reused assignment (or switchback slot) follows its arm across refreshes: no variables while
		// a refresh has removed the arm, and the arm's current variables again once a later refresh
		// restores it.
		const followArm = (experiment: Experiment, assignment: Assignment | undefined) => {
			if (assignment === undefined) return;
			if (assignment.variant >= experiment.data.variants.length) {
				assignment.variables = undefined;
			} else if (assignment.variables === undefined && assignment.id === experiment.data.id) {
				assignment.variables = experiment.variables[assignment.variant];
			}
		};
		const indexed = (experimentName: string) =>
			Object.prototype.hasOwnProperty.call(index, experimentName) ? index[experimentName] : undefined;
		for (const experimentName of Object.keys(assignments)) {
			const experiment = indexed(experimentName);
			if (experiment !== undefined) followArm(experiment, assignments[experimentName]);
		}
		if (epochs !== undefined) {
			for (const experimentName of Object.keys(epochs)) {
				const experiment = indexed(experimentName);
				if (experiment === undefined) continue;
				const epoch = epochs[experimentName];
				followArm(experiment, epoch.periodless);
				for (const period of epoch.periods) followArm(experiment, epoch.slots[period]);
			}
		}

		this._index = index;
		this._indexVariables = indexVariables;
		this._assignments = assignments;

		if (!this._failed && this._opts.refreshPeriod > 0 && !this._refreshInterval) {
			// _refresh already logs refresh errors via the callback.
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
