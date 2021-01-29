"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mergeConfig = mergeConfig;

var _default = _interopRequireDefault(require("rfdc/default"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function mergeConfig(context, previousConfig) {
  const merged = (0, _default.default)(previousConfig);
  const experiments = context.experiments();

  const isObject = x => x instanceof Object && x.constructor === Object;

  var _iterator = _createForOfIteratorHelper(experiments),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      const experimentName = _step.value;
      const experimentConfig = context.experimentConfig(experimentName);

      for (var _i = 0, _Object$entries = Object.entries(experimentConfig); _i < _Object$entries.length; _i++) {
        const _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
              configKey = _Object$entries$_i[0],
              configValue = _Object$entries$_i[1];

        let target = merged;
        let key = configKey;

        if (key.indexOf(".") !== -1) {
          const frags = key.split(".");
          key = frags.pop();

          for (const index in frags) {
            const frag = frags[index];

            if (frag in target) {
              if (isObject(target[frag])) {
                target = target[frag];
              } else {
                console.warn(`Config key '${configKey}' for experiment '${experimentName}' is overriding non-object value at '${frags.slice(0, index + 1).join(".")}' with an object.`);
                target = target[frag] = {};
              }
            } else {
              target = target[frag] = {};
            }
          }
        }

        if (key in target && `_${key}_setter` in target) {
          console.error(`Config key '${configKey}' already set by experiment '${target[`_${key}_setter`]}'.`);
        } else {
          Object.defineProperty(target, `_${key}_setter`, {
            value: experimentName,
            writable: false
          });

          if (key in target) {
            if (isObject(target[key]) && !isObject(configValue)) {
              console.warn(`Config key '${configKey}' for experiment '${experimentName}' is overriding object with non-object value.`);
            } else if (!isObject(target[key]) && isObject(configValue)) {
              console.warn(`Config key '${configKey}' for experiment '${experimentName}' is overriding non-object value with object.`);
            }
          }

          Object.defineProperty(target, key, {
            get: () => {
              context.treatment(experimentName);
              return configValue;
            }
          });
        }
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return merged;
}