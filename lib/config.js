"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mergeConfig = mergeConfig;

var _default = _interopRequireDefault(require("rfdc/default"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

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

      var _iterator2 = _createForOfIteratorHelper(experimentConfig),
          _step2;

      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          const configKey = _step2.value;
          let target = merged;
          let key = configKey.key;

          if (key.indexOf(".") !== -1) {
            const frags = key.split(".");
            key = frags.pop();

            for (const index in frags) {
              const frag = frags[index];

              if (frag in target) {
                if (isObject(target[frag])) {
                  target = target[frag];
                } else {
                  console.warn(`Config key '${configKey.key}' for experiment '${experimentName}' is overriding non-object value at '${frags.slice(0, index + 1).join(".")}' with an object.`);
                  target = target[frag] = {};
                }
              } else {
                target = target[frag] = {};
              }
            }
          }

          if (key in target && `_${key}_setter` in Object.getOwnPropertyDescriptor(target, key)) {
            console.error(`Config key '${configKey.key}' already set by experiment ${target[`_${key}_setter`]}`);
          } else {
            Object.defineProperty(target, `_${key}_setter`, {
              value: experimentName,
              writable: false
            });
            let value;

            switch (configKey.format || "string") {
              case "string":
                value = configKey.value;
                break;

              case "json":
                try {
                  value = JSON.parse(configKey.value);
                } catch (e) {
                  console.warn(`Error parsing JSON in Config key '${configKey.key}' for experiment '${experimentName}': ${e}`);
                }

                break;

              default:
                console.warn(`Unsupported format '${configKey.format}' in Config key '${configKey.key}' for experiment '${experimentName}'.`);
                value = configKey.value;
                break;
            }

            if (key in target) {
              if (isObject(target[key]) && !isObject(value)) {
                console.warn(`Config key '${configKey.key}' for experiment '${experimentName}' is overriding object with non-object value.`);
              } else if (!isObject(target[key]) && isObject(value)) {
                console.warn(`Config key '${configKey.key}' for experiment '${experimentName}' is overriding non-object value with object.`);
              }
            }

            Object.defineProperty(target, key, {
              get: () => {
                context.treatment(experimentName);
                return value;
              }
            });
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return merged;
}