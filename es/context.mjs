export default class Context {
  constructor(sdk, client, promise) {
    this.sdk = sdk;
    this.client = client;
    this.pendingCount = 0;
    this.failed = false;

    const initialize = data => {
      this._data = data;
      this.assignments = Object.assign({}, ...(data.assignments || []).map((experiment, index) => ({
        [experiment.name]: index
      })));
      this.exposed = {};
      this.pendingExposures = [];
      this.pendingGoals = [];
      this.currentAttributes = [];
    };

    if (promise instanceof Promise) {
      this.promise = promise.then(data => {
        initialize(data);
        delete this.promise;
      }).catch(error => {
        console.error(`ABSmartly Context: ${error}`);
        initialize({});
        this.failed = true;
        delete this.promise;
      });
    } else {
      initialize(promise);
    }
  }

  isReady() {
    return this.promise === undefined;
  }

  isFailed() {
    return this.failed;
  }

  ready() {
    if (this.isReady()) {
      return Promise.resolve(true);
    }

    return new Promise(resolve => {
      this.promise.then(() => resolve(true)).catch(e => resolve(e));
    });
  }

  pending() {
    return this.pendingCount;
  }

  data() {
    this._checkReady();

    return this._data;
  }

  publish() {
    this._checkReady();

    return new Promise((resolve, reject) => {
      this._flush(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  attribute(attrName, value) {
    this.currentAttributes.push({
      name: attrName,
      value: value.toString(),
      setAt: Date.now()
    });
  }

  attributes(attrs) {
    const now = Date.now();

    for (const [attrName, value] of Object.entries(attrs)) {
      this.currentAttributes.push({
        name: attrName,
        value: value.toString(),
        setAt: now
      });
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
      return this._data.assignments[this.assignments[experimentName]].config || [];
    }

    return [];
  }

  _checkReady() {
    if (!this.isReady()) {
      throw new Error("ABSmartly Context is not yet ready.");
    }
  }

  _treatment(experimentName) {
    this._checkReady();

    const assigned = (experimentName in this.assignments);
    const variant = assigned ? this._data.assignments[this.assignments[experimentName]].variant : 0;
    const exposed = (experimentName in this.exposed);

    if (!exposed) {
      this.pendingExposures.push({
        name: experimentName,
        variant,
        exposedAt: Date.now(),
        assigned
      });
      this.pendingCount++;
      this.exposed[experimentName] = true;
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

      if (values.some(x => !Number.isInteger(x))) {
        throw new Error("Goal values must be integers");
      }
    }

    this.pendingGoals.push({
      name: goalName,
      values,
      achievedAt: Date.now()
    });
    this.pendingCount++;
  }

  _flush(callback) {
    if (this.pendingCount === 0) {
      if (typeof callback === "function") {
        callback();
      }
    } else {
      if (!this.failed) {
        const request = {
          guid: this._data.guid,
          units: this._data.units,
          application: this._data.application
        };

        if (this.pendingGoals.length > 0) {
          request.goals = this.pendingGoals.map(x => ({
            name: x.name,
            achievedAt: x.achievedAt,
            values: x.values
          }));
        }

        if (this.pendingExposures.length > 0) {
          request.exposures = this.pendingExposures.map(x => ({
            name: x.name,
            exposedAt: x.exposedAt,
            variant: x.variant,
            assigned: x.assigned
          }));
        }

        if (this.currentAttributes.length > 0) {
          request.attributes = this.currentAttributes.map(x => ({
            name: x.name,
            value: x.value,
            setAt: x.setAt
          }));
        }

        this.client.publish(request).then(() => {
          if (typeof callback === "function") {
            callback();
          }
        }).catch(e => {
          if (typeof callback === "function") {
            callback(e);
          }
        });
      } else {
        if (typeof callback === "function") {
          callback();
        }
      }

      this.pendingCount = 0;
      this.pendingExposures = [];
      this.pendingGoals = [];
    }
  }

}