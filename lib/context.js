"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

class Context {
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
    this._attrs.push({
      name: attrName,
      value: value.toString(),
      setAt: Date.now()
    });
  }

  attributes(attrs) {
    const now = Date.now();

    for (var _i = 0, _Object$entries = Object.entries(attrs); _i < _Object$entries.length; _i++) {
      const _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
            attrName = _Object$entries$_i[0],
            value = _Object$entries$_i[1];

      this._attrs.push({
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

exports.default = Context;