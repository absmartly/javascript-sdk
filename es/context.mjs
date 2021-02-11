export default class Context {
  constructor(sdk, client, options, promise) {
    this._sdk = sdk;
    this._cli = client;
    this._opts = options;
    this._pending = 0;
    this._failed = false;

    if (promise instanceof Promise) {
      this._promise = promise.then(data => {
        this._init(data);

        delete this._promise;
      }).catch(error => {
        console.error(`ABSmartly Context: ${error}`);

        this._init({});

        this._failed = true;
        delete this._promise;
      });
    } else {
      this._init(promise);
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

    return new Promise(resolve => {
      this._promise.then(() => resolve(true)).catch(e => resolve(e));
    });
  }

  pending() {
    return this._pending;
  }

  data() {
    this._checkReady();

    return this._data;
  }

  client() {
    return this._cli;
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

  refresh() {
    this._checkReady();

    return new Promise((resolve, reject) => {
      this._refresh(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  attribute(attrName, value) {
    const allowed = v => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";

    if (Array.isArray(value)) {
      if (value.length > 0) {
        let typeSeen = value[0] == null ? null : typeof value[0];

        for (let i = 0; i < value.length; ++i) {
          const element = value[i];

          if (!allowed(element)) {
            throw new Error(`Attribute '${attrName}' element at index ${i} is of unsupported type '${typeof value}'`);
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

    this._attrs.push({
      name: attrName,
      value: value,
      setAt: Date.now()
    });
  }

  attributes(attrs) {
    for (const [attrName, value] of Object.entries(attrs)) {
      this.attribute(attrName, value);
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

    return Object.keys(this._assignments);
  }

  experimentConfig(experimentName) {
    this._checkReady();

    if (experimentName in this._assignments) {
      return this._data.assignments[this._assignments[experimentName]].config || {};
    }

    return {};
  }

  createVariantOverride(experimentName, variant) {
    return this.createVariantOverrides({
      [experimentName]: variant
    });
  }

  createVariantOverrides(overrides) {
    return this._cli.createVariantOverride({
      units: this._data.units,
      overrides: Object.entries(overrides).map(entry => ({
        name: entry[0],
        variant: entry[1]
      }))
    });
  }

  getVariantOverride(experimentName) {
    return this._cli.getVariantOverride({
      units: this._data.units,
      experiment: experimentName
    });
  }

  getVariantOverrides() {
    return this._cli.getVariantOverride({
      units: this._data.units
    });
  }

  removeVariantOverride(experimentName) {
    return this._cli.removeVariantOverride({
      units: this._data.units,
      experiment: experimentName
    });
  }

  removeVariantOverrides() {
    return this._cli.removeVariantOverride({
      units: this._data.units
    });
  }

  _checkReady() {
    if (!this.isReady()) {
      throw new Error("ABSmartly Context is not yet ready.");
    }
  }

  _treatment(experimentName) {
    this._checkReady();

    const assigned = (experimentName in this._assignments);
    const variant = assigned ? this._data.assignments[this._assignments[experimentName]].variant : 0;
    const exposed = (experimentName in this._exposed);

    if (!exposed) {
      this._exposures.push({
        name: experimentName,
        variant,
        exposedAt: Date.now(),
        assigned
      });

      this._pending++;
      this._exposed[experimentName] = true;

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

      if (values.some(x => !Number.isInteger(x))) {
        throw new Error("Goal values must be integers");
      }
    }

    this._goals.push({
      name: goalName,
      values,
      achievedAt: Date.now()
    });

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
          units: this._data.units
        };

        if (this._goals.length > 0) {
          request.goals = this._goals.map(x => ({
            name: x.name,
            achievedAt: x.achievedAt,
            values: x.values
          }));
        }

        if (this._exposures.length > 0) {
          request.exposures = this._exposures.map(x => ({
            name: x.name,
            exposedAt: x.exposedAt,
            variant: x.variant,
            assigned: x.assigned
          }));
        }

        if (this._attrs.length > 0) {
          request.attributes = this._attrs.map(x => ({
            name: x.name,
            value: x.value,
            setAt: x.setAt
          }));
        }

        this._cli.publish(request).then(() => {
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

      this._pending = 0;
      this._exposures = [];
      this._goals = [];
    }
  }

  _refresh(callback) {
    if (!this._failed) {
      const request = {
        guid: this._data.guid,
        units: this._data.units
      };

      this._cli.refreshContext(request).then(data => {
        this._init(data, this._exposed);

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
  }

  _init(data, exposed = {}) {
    this._data = data;
    this._assignments = Object.assign({}, ...(data.assignments || []).map((experiment, index) => ({
      [experiment.name]: index
    })));
    this._exposed = exposed;
    this._exposures = [];
    this._goals = [];
    this._attrs = [];
  }

}