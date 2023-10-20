import { arrayEqualsShallow, hashUnit, isObject, isPromise } from "./utils";
import { VariantAssigner } from "./assigner";
import { AudienceMatcher } from "./matcher";
import { insertUniqueSorted } from "./algorithm";
import SDK, { EventLogger, EventName } from "./sdk";
import { ContextPublisher, PublishParams } from "./publisher";
import { ContextDataProvider } from "./provider";
import { ClientRequestOptions } from "./client";

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
	audienceStrict: boolean;
	split: number[];
	seedHi: number;
	seedLo: number;
	variants: { config: null | string }[];
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
	trafficSplit?: number[];
	variables?: Record<string, unknown>;
};

export type Experiment = {
	data: ExperimentData;
	variables: Record<string, unknown>[];
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
};

export type ContextData = {
	experiments?: ExperimentData[];
};

export default class Context {
	private readonly _assigners: Record<string, VariantAssigner>;
	private readonly _attrs: Attribute[];
	private readonly _audienceMatcher: AudienceMatcher;
	private readonly _cassignments: Record<string, number>;
	private readonly _dataProvider: ContextDataProvider;
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
	private _overrides: Record<string, number>;
	private _pending: number;
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
		this._audienceMatcher = new AudienceMatcher();

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

	private _checkReady(expectNotFinalized?: boolean) {
		if (!this.isReady()) {
			throw new Error("ABSmartly Context is not yet ready.");
		}

		if (expectNotFinalized) {
			this._checkNotFinalized();
		}
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

		const hasCustom = experimentName in this._cassignments;
		const hasOverride = experimentName in this._overrides;
		const experiment = experimentName in this._index ? this._index[experimentName] : null;

		if (experimentName in this._assignments) {
			const assignment = this._assignments[experimentName];
			if (hasOverride) {
				if (assignment.overridden && assignment.variant === this._overrides[experimentName]) {
					// override up-to-date
					return assignment;
				}
			} else if (experiment == null) {
				if (!assignment.assigned) {
					// previously not-running experiment
					return assignment;
				}
			} else if (!hasCustom || this._cassignments[experimentName] === assignment.variant) {
				if (experimentMatches(experiment.data, assignment)) {
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
		};

		this._assignments[experimentName] = assignment;

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

				if (experiment.data.audience && experiment.data.audience.length > 0) {
					const attrs: Record<string, unknown> = {};
					this._attrs.forEach((attr) => {
						attrs[attr.name] = attr.value;
					});

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

				// store these so we can detect changes to running experiment
				assignment.unitType = unitType;
				assignment.id = experiment.data.id;
				assignment.iteration = experiment.data.iteration;
				assignment.trafficSplit = experiment.data.trafficSplit;
				assignment.fullOnVariant = experiment.data.fullOnVariant;
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

			this._queueExposure(experimentName, assignment);
		}

		return assignment;
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
		};
		this._logEvent("exposure", exposureEvent);

		this._exposures.push(exposureEvent);
		this._pending++;

		this._setTimeout();
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

	private _variableValue(key: string, defaultValue: string): string {
		for (const i in this._indexVariables[key]) {
			const experimentName = this._indexVariables[key][i].data.name;
			const assignment = this._assign(experimentName);
			if (assignment.variables !== undefined) {
				if (!assignment.exposed) {
					assignment.exposed = true;

					this._queueExposure(experimentName, assignment);
				}

				if (key in assignment.variables && (assignment.assigned || assignment.overridden)) {
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
				if (key in assignment.variables && (assignment.assigned || assignment.overridden)) {
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
				const request: PublishParams = {
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
					}));
				}

				if (this._attrs.length > 0) {
					request.attributes = this._attrs.map((x) => ({
						name: x.name,
						value: x.value,
						setAt: x.setAt,
					}));
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

	private _unitHash(unitType: string) {
		if (!this._hashes) {
			this._hashes = {};
		}

		if (!(unitType in this._hashes)) {
			const hash = unitType in this._units ? hashUnit(this._units[unitType]) : null;
			this._hashes[unitType] = hash;
			return hash;
		}

		return this._hashes[unitType];
	}

	private _init(data: ContextData, assignments: Record<string, Assignment> = {}) {
		this._data = data;

		const index: Record<string, Experiment> = {};
		const indexVariables: Record<string, Experiment[]> = {};

		(data.experiments || []).forEach((experiment) => {
			const variables: Record<string, unknown>[] = [];
			const entry = {
				data: experiment,
				variables,
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
