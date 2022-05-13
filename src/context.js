import { arrayEqualsShallow, hashUnit, isObject, isNumeric, isPromise } from "./utils";
import { VariantAssigner } from "./assigner";
import { AudienceMatcher } from "./matcher";

export default class Context {
	constructor(sdk, options, params, promise) {
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
		this._params = params;
		this._assigners = {};
		this._audienceMatcher = new AudienceMatcher();

		if (isPromise(promise)) {
			this._promise = promise
				.then((data) => {
					this._init(data);
					delete this._promise;

					this._logEvent("ready", data);

					if (this.pending() > 0) {
						this._setTimeout();
					}
				})
				.catch((error) => {
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
			this._promise.then(() => resolve(true)).catch((e) => resolve(e));
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

	publish(requestOptions) {
		this._checkReady(true);

		return new Promise((resolve, reject) => {
			this._flush((error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			}, requestOptions);
		});
	}

	refresh(requestOptions) {
		this._checkReady(true);

		return new Promise((resolve, reject) => {
			this._refresh((error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			}, requestOptions);
		});
	}

	attribute(attrName, value) {
		const allowed = (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
		if (Array.isArray(value)) {
			if (value.length > 0) {
				let typeSeen = value[0] == null ? null : typeof value[0];

				for (let i = 0; i < value.length; ++i) {
					const element = value[i];
					if (!allowed(element)) {
						throw new Error(
							`Attribute '${attrName}' element at index ${i} is of unsupported type '${typeof value}'`
						);
					} else if (element != null) {
						if (typeSeen == null) {
							typeSeen = typeof element;
						} else {
							if (typeof element !== typeSeen) {
								throw new Error(`Attribute '${attrName}' has elements of different types`);
							}
						}
					}
				}
			}
		} else if (!allowed(value)) {
			throw new Error(`Attribute '${attrName}' is of unsupported type '${typeof value}'`);
		}

		this._attrs.push({ name: attrName, value: value, setAt: Date.now() });
	}

	attributes(attrs) {
		for (const [attrName, value] of Object.entries(attrs)) {
			this.attribute(attrName, value);
		}
	}

	peek(experimentName) {
		this._checkReady(true);

		return this._peek(experimentName).variant;
	}

	treatment(experimentName) {
		this._checkReady(true);

		return this._treatment(experimentName).variant;
	}

	track(goalName, properties) {
		this._checkNotFinalized();

		return this._track(goalName, properties);
	}

	finalize(requestOptions) {
		return this._finalize(requestOptions);
	}

	experiments() {
		this._checkReady();

		return this._data.experiments.map((x) => x.name);
	}

	variableValue(key, defaultValue) {
		this._checkReady(true);

		return this._variableValue(key, defaultValue);
	}

	peekVariableValue(key, defaultValue) {
		this._checkReady(true);

		return this._peekVariable(key, defaultValue);
	}

	variableKeys() {
		this._checkReady(true);

		return Object.assign({}, ...Object.entries(this._indexVariables).map((x) => ({ [x[0]]: x[1].data.name })));
	}

	override(experimentName, variant) {
		this._overrides = Object.assign(this._overrides, { [experimentName]: variant });
	}

	overrides(experimentVariants) {
		for (const [experimentName, variant] of Object.entries(experimentVariants)) {
			this.override(experimentName, variant);
		}
	}

	customAssignment(experimentName, variant) {
		this._cassignments[experimentName] = variant;
	}

	customAssignments(experimentVariants) {
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

	_checkReady(expectNotFinalized) {
		if (!this.isReady()) {
			throw new Error("ABSmartly Context is not yet ready.");
		}

		if (expectNotFinalized) {
			this._checkNotFinalized();
		}
	}

	_assign(experimentName) {
		const experimentMatches = (experiment, assignment) => {
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

		const assignment = {
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
				assignment.assigned = experiment.data.unitType in this._params.units;
			}

			assignment.overridden = true;
			assignment.variant = this._overrides[experimentName];
		} else {
			if (experiment != null) {
				const unitType = experiment.data.unitType;

				if (experiment.data.audience && experiment.data.audience.length > 0) {
					const attrs = {};
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
					if (unitType in this._params.units) {
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

	_peek(experimentName) {
		return this._assign(experimentName);
	}

	_treatment(experimentName) {
		const assignment = this._assign(experimentName);

		if (!assignment.exposed) {
			assignment.exposed = true;

			this._queueExposure(experimentName, assignment);
		}

		return assignment;
	}

	_queueExposure(experimentName, assignment) {
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

	_variableValue(key, defaultValue) {
		if (key in this._indexVariables) {
			const experimentName = this._indexVariables[key].data.name;
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

	_peekVariable(key, defaultValue) {
		if (key in this._indexVariables) {
			const experimentName = this._indexVariables[key].data.name;
			const assignment = this._assign(experimentName);
			if (assignment.variables !== undefined) {
				if (key in assignment.variables) {
					return assignment.variables[key];
				}
			}
		}

		return defaultValue;
	}

	_validateGoal(goalName, properties) {
		if (properties !== null && properties !== undefined) {
			if (!isObject(properties)) {
				throw new Error(`Goal '${goalName}' properties must be of type object.`);
			}

			return Object.assign(
				{},
				...Object.entries(properties).map((entry) => {
					const key = entry[0];
					const value = entry[1];

					if (isNumeric(value)) {
						return { [key]: value };
					} else if (isObject(value)) {
						const filtered = this._validateGoal(goalName, value);
						if (Object.keys(filtered).length > 0) {
							return { [key]: filtered };
						}
					} else if (value !== null) {
						throw new Error(`Goal '${goalName}' property value type must be one of [number, object].`);
					}
					return undefined;
				})
			);
		}

		return null;
	}

	_track(goalName, properties) {
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

	_flush(callback, requestOptions) {
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
				if (!this._units) {
					this._units = Object.entries(this._params.units).map((entry) => ({
						type: entry[0],
						uid: this._unitHash(entry[0]),
					}));
				}

				const request = {
					publishedAt: Date.now(),
					units: this._units,
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
					.catch((e) => {
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

	_refresh(callback, requestOptions) {
		if (!this._failed) {
			this._dataProvider
				.getContextData(this._sdk, requestOptions)
				.then((data) => {
					this._init(data, this._assignments);

					this._logEvent("refresh", data);

					if (typeof callback === "function") {
						callback();
					}
				})
				.catch((e) => {
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

	_logEvent(eventName, data) {
		if (this._eventLogger) {
			this._eventLogger(this, eventName, data);
		}
	}

	_logError(error) {
		if (this._eventLogger) {
			this._eventLogger(this, "error", error);
		}
	}

	_unitHash(unitType) {
		if (!this._hashes) {
			this._hashes = {};
		}

		if (!(unitType in this._hashes)) {
			const hash = unitType in this._params.units ? hashUnit(this._params.units[unitType]) : null;
			this._hashes[unitType] = hash;
			return hash;
		}

		return this._hashes[unitType];
	}

	_init(data, assignments = {}) {
		this._data = data;

		const index = {};
		const indexVariables = {};

		for (const experiment of data.experiments || []) {
			const variables = [];
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
					indexVariables[key] = entry;
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

	_finalize(requestOptions) {
		if (!this._finalized) {
			if (!this._finalizing) {
				if (this._refreshInterval !== undefined) {
					clearInterval(this._refreshInterval);
					delete this._refreshInterval;
				}

				if (this.pending() > 0) {
					this._finalizing = new Promise((resolve, reject) => {
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
