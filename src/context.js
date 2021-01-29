export default class Context {
	constructor(sdk, client, options, promise) {
		this._sdk = sdk;
		this._cli = client;
		this._opts = options;
		this._pending = 0;
		this._failed = false;

		const initialize = (data) => {
			this._data = data;

			this.assignments = Object.assign(
				{},
				...(data.assignments || []).map((experiment, index) => ({ [experiment.name]: index }))
			);
			this.exposed = {};

			this._exposures = [];
			this._goals = [];
			this._attrs = [];
		};

		if (promise instanceof Promise) {
			this._promise = promise
				.then((data) => {
					initialize(data);

					delete this._promise;
				})
				.catch((error) => {
					console.error(`ABSmartly Context: ${error}`);

					initialize({});

					this._failed = true;
					delete this._promise;
				});
		} else {
			initialize(promise);
		}
	}

	isReady() {
		return this._promise === undefined;
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

	publish() {
		this._checkReady();

		return new Promise((resolve, reject) => {
			this._flush((error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	attribute(attrName, value) {
		this._attrs.push({ name: attrName, value: value.toString(), setAt: Date.now() });
	}

	attributes(attrs) {
		const now = Date.now();
		for (const [attrName, value] of Object.entries(attrs)) {
			this._attrs.push({ name: attrName, value: value.toString(), setAt: now });
		}
	}

	treatment(experimentName, callback) {
		return this._treatment(experimentName, callback);
	}

	track(goalName, values, callback) {
		return this._track(goalName, values, callback);
	}

	experiments() {
		this._checkReady();

		return Object.keys(this.assignments);
	}

	experimentConfig(experimentName) {
		this._checkReady();

		if (experimentName in this.assignments) {
			return this._data.assignments[this.assignments[experimentName]].config || {};
		}

		return {};
	}

	_checkReady() {
		if (!this.isReady()) {
			throw new Error("ABSmartly Context is not yet ready.");
		}
	}

	_treatment(experimentName) {
		this._checkReady();

		const assigned = experimentName in this.assignments;
		const variant = assigned ? this._data.assignments[this.assignments[experimentName]].variant : 0;
		const exposed = experimentName in this.exposed;

		if (!exposed) {
			this._exposures.push({ name: experimentName, variant, exposedAt: Date.now(), assigned });
			this._pending++;
			this.exposed[experimentName] = true;

			this._setTimeout();
		}
		return variant;
	}

	_track(goalName, values = null) {
		this._checkReady();

		if (values !== null && values !== undefined) {
			if (!Array.isArray(values)) {
				values = [values];
			} else if (values.length > 2) {
				throw new Error("Goal values array length must be <= 2.");
			}

			if (values.some((x) => !Number.isInteger(x))) {
				throw new Error("Goal values must be integers");
			}
		}

		this._goals.push({ name: goalName, values, achievedAt: Date.now() });
		this._pending++;

		this._setTimeout();
	}

	_setTimeout() {
		if (this.timeout === undefined && this._opts.publishDelay >= 0) {
			this.timeout = setTimeout(() => {
				this._flush();
			}, this._opts.publishDelay);
		}
	}

	_flush(callback) {
		if (this.timeout !== undefined) {
			clearTimeout(this.timeout);
			delete this.timeout;
		}

		if (this._pending === 0) {
			if (typeof callback === "function") {
				callback();
			}
		} else {
			if (!this._failed) {
				const request = {
					guid: this._data.guid,
					units: this._data.units,
					application: this._data.application,
				};

				if (this._goals.length > 0) {
					request.goals = this._goals.map((x) => ({
						name: x.name,
						achievedAt: x.achievedAt,
						values: x.values,
					}));
				}

				if (this._exposures.length > 0) {
					request.exposures = this._exposures.map((x) => ({
						name: x.name,
						exposedAt: x.exposedAt,
						variant: x.variant,
						assigned: x.assigned,
					}));
				}

				if (this._attrs.length > 0) {
					request.attributes = this._attrs.map((x) => ({
						name: x.name,
						value: x.value,
						setAt: x.setAt,
					}));
				}

				this._cli
					.publish(request)
					.then(() => {
						if (typeof callback === "function") {
							callback();
						}
					})
					.catch((e) => {
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
}
