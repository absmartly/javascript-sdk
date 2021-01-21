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

    for (var _i = 0, _Object$entries = Object.entries(attrs); _i < _Object$entries.length; _i++) {
      const _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
            attrName = _Object$entries$_i[0],
            value = _Object$entries$_i[1];

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

exports.default = Context;