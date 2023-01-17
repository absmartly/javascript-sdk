import { arrayEqualsShallow, hashUnit, isObject, isPromise } from "./utils";
import { VariantAssigner } from "./assigner";
import { AudienceMatcher } from "./matcher";
import { insertUniqueSorted } from "./algorithm";
import SDK from "./sdk";
import { ContextPublisher } from "./publisher";
import { ContextDataProvider } from "./provider";
import { EventLogger } from "./types";

export default class Context {
	private readonly _sdk: SDK;
	private readonly _publisher: ContextPublisher;
	private readonly _dataProvider: ContextDataProvider;
	private readonly _eventLogger: EventLogger;
	private readonly _opts: Record<string, any>;
	private readonly _attrs: { name: string; value: any; setAt: number }[];
	private readonly _cassignments: Record<string, any>;
	private readonly _units: Record<string, any>;
	private readonly _assigners: Record<string, any>;
	private readonly _audienceMatcher: AudienceMatcher;
	private _pending: number;
	private _publishTimeout?: ReturnType<typeof setTimeout>;
	private _indexVariables: Record<string, any>;
	private _index: Record<string, any>;
	private _failed: boolean;
	private _data: Record<string, any>;
	private _finalized: boolean;
	private _finalizing: boolean | Promise<void> | null;
	private _goals: Record<string, unknown>[];
	private _exposures: Record<string, unknown>[];
	private _overrides: Record<string, any>;
	private _assignments: Record<string, any>;
	private _refreshInterval?: ReturnType<typeof setInterval>;
	private _hashes: Record<string, string | null>;
	private _promise?: Promise<any>;

	constructor(
		sdk: SDK,
		options: Record<string, any>,
		params: Record<string, any>,
		promise: Promise<any> | Record<string, any>
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

		if (params.units) {
			this.units(params.units);
		}

		if (isPromise(promise)) {
			this._promise = promise
				.then((data: Record<string, unknown>) => {
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

	publish(requestOptions: Record<string, unknown>) {
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

	refresh(requestOptions: Record<string, unknown>) {
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
		for (const [unitType, uid] of Object.entries(units)) {
			this.unit(unitType, uid);
		}
	}

	getAttribute(attrName: string) {
		let result;

		for (const attr of this._attrs) {
			if (attr.name === attrName) result = attr.value;
		}

		return result;
	}

	attribute(attrName: string, value: any) {
		this._checkNotFinalized();

		this._attrs.push({ name: attrName, value: value, setAt: Date.now() });
	}

	getAttributes() {
		const attributes: Record<string, unknown> = {};
		for (const [key, value] of this._attrs.map((a) => [a.name, a.value])) {
			attributes[key] = value;
		}
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

	track(goalName: string, properties: Record<string, unknown>) {
		this._checkNotFinalized();

		return this._track(goalName, properties);
	}

	finalize(requestOptions: Record<string, any>) {
		return this._finalize(requestOptions);
	}

	experiments() {
		this._checkReady();

		return this._data.experiments.map((x: { name: string }) => x.name);
	}

	variableValue(key: string, defaultValue: any) {
		this._checkReady(true);

		return this._variableValue(key, defaultValue);
	}

	peekVariableValue(key: string, defaultValue: any) {
		this._checkReady(true);

		return this._peekVariable(key, defaultValue);
	}

	variableKeys() {
		this._checkReady(true);

		const variableExperiments: Record<string, unknown[]> = {};

		for (const [key, values] of Object.entries(this._indexVariables)) {
			for (const i in values) {
				if (variableExperiments[key]) variableExperiments[key].push(values[i].data.name);
				else variableExperiments[key] = [values[i].data.name];
			}
		}

		return variableExperiments;
	}

	override(experimentName: string, variant: number) {
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

	_checkNotFinalized() {
		if (this.isFinalized()) {
			throw new Error("ABSmartly Context is finalized.");
		} else if (this.isFinalizing()) {
			throw new Error("ABSmartly Context is finalizing.");
		}
	}

	_checkReady(expectNotFinalized?: boolean) {
		if (!this.isReady()) {
			throw new Error("ABSmartly Context is not yet ready.");
		}

		if (expectNotFinalized) {
			this._checkNotFinalized();
		}
	}

	_assign(experimentName: string) {
		const experimentMatches = (experiment: Record<string, any>, assignment: Record<string, any>) => {
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

		const assignment: Record<string, any> = {
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
					for (const attr of this._attrs) {
						attrs[attr.name] = attr.value;
					}

					const result = this._audienceMatcher.evaluate(experiment.data.audience, attrs);

					if (typeof result === "boolean") {
						assignment.audienceMismatch = !result;
					}
				}

				if (experiment.data.audienceStrict && assignment.audienceMismatch !== false) {
					assignment.variant = 0;
				} else if (experiment.data.fullOnVariant === 0) {
					if (unitType in this._units) {
						const unit = this._unitHash(unitType);
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

	_peek(experimentName: string) {
		return this._assign(experimentName);
	}

	_treatment(experimentName: string) {
		const assignment = this._assign(experimentName);

		if (!assignment.exposed) {
			assignment.exposed = true;

			this._queueExposure(experimentName, assignment);
		}

		return assignment;
	}

	_queueExposure(experimentName: string, assignment: Record<string, any>) {
		const exposureEvent = {
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

	_variableValue(key: string, defaultValue: unknown) {
		for (const i in this._indexVariables[key]) {
			const experimentName = this._indexVariables[key][i].data.name;
			const assignment = this._assign(experimentName);
			if (assignment.variables !== undefined) {
				if (!assignment.exposed) {
					assignment.exposed = true;

					this._queueExposure(experimentName, assignment);
				}

				if (key in assignment.variables) {
					return assignment.variables[key];
				}
			}
		}

		return defaultValue;
	}

	_peekVariable(key: string, defaultValue: unknown) {
		for (const i in this._indexVariables[key]) {
			const experimentName = this._indexVariables[key][i].data.name;
			const assignment = this._assign(experimentName);
			if (assignment.variables !== undefined) {
				if (key in assignment.variables) {
					return assignment.variables[key];
				}
			}
		}

		return defaultValue;
	}

	_validateGoal(goalName: string, properties: Record<string, unknown>) {
		if (properties !== null && properties !== undefined) {
			if (!isObject(properties)) {
				throw new Error(`Goal '${goalName}' properties must be of type object.`);
			}

			return { ...properties };
		}

		return null;
	}

	_track(goalName: string, properties: Record<string, unknown>) {
		const props = this._validateGoal(goalName, properties);
		const goalEvent = { name: goalName, properties: props, achievedAt: Date.now() };
		this._logEvent("goal", goalEvent);

		this._goals.push(goalEvent);
		this._pending++;

		this._setTimeout();
	}

	_setTimeout() {
		if (this.isReady()) {
			if (this._publishTimeout === undefined && this._opts.publishDelay >= 0) {
				this._publishTimeout = setTimeout(() => {
					this._flush();
				}, this._opts.publishDelay);
			}
		}
	}

	_flush(callback?: (error?: Error) => void, requestOptions?: Record<string, unknown>) {
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
				const request: Record<string, unknown> = {
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

	_refresh(callback?: (error?: Error) => void, requestOptions?: Record<string, unknown>) {
		if (!this._failed) {
			this._dataProvider
				.getContextData(this._sdk, requestOptions)
				.then((data: Record<string, unknown>) => {
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

	_logEvent(eventName: string, data?: any) {
		if (this._eventLogger) {
			this._eventLogger(this, eventName, data);
		}
	}

	_logError(error: Error) {
		if (this._eventLogger) {
			this._eventLogger(this, "error", error);
		}
	}

	_unitHash(unitType: string) {
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

	_init(data: Record<string, any>, assignments = {}) {
		this._data = data;

		const index: Record<string, any> = {};
		const indexVariables: Record<string, any> = {};

		for (const experiment of data.experiments || []) {
			const variables: any[] = [];
			const entry = {
				data: experiment,
				variables,
			};

			index[experiment.name] = entry;

			for (let i = 0; i < experiment.variants.length; ++i) {
				const variant = experiment.variants[i];
				const config = variant.config;
				const parsed = config != null && config.length > 0 ? JSON.parse(config) : {};

				for (const key of Object.keys(parsed)) {
					const value = entry;
					if (indexVariables[key]) {
						insertUniqueSorted(
							indexVariables[key],
							value,
							(a: Record<string, any>, b: Record<string, any>) => a.data.id < b.data.id
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

	_finalize(requestOptions: Record<string, unknown>) {
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
