"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _javascriptClient = require("@absmartly/javascript-client");

var _context = _interopRequireDefault(require("./context"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class SDK {
  constructor(options) {
    options = Object.assign({
      agent: "javascript-sdk"
    }, options);
    this.client = new _javascriptClient.Client(options);
  }

  createContext(params, options) {
    const transformed = Object.assign({}, {
      units: Object.keys(params.units).map(type => ({
        type,
        uid: params.units[type]
      }))
    });
    options = SDK._contextOptions(options);
    const data = this.client.createContext(transformed);
    return new _context.default(this, this.client, options, data);
  }

  createContextWith(data, options) {
    options = SDK._contextOptions(options);
    return new _context.default(this, this.client, options, data);
  }

  static _contextOptions(options) {
    const isBrowser = typeof window !== "undefined" && typeof window.navigator !== "undefined";
    return Object.assign({
      publishDelay: isBrowser ? 200 : -1
    }, options || {});
  }

}

exports.default = SDK;