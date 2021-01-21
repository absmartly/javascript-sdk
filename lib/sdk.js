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

  createContext(params) {
    const transformed = Object.assign({}, params, {
      units: Object.keys(params.units).map(type => ({
        type,
        uid: params.units[type]
      }))
    });
    const data = this.client.createContext(transformed);
    return new _context.default(this, this.client, data);
  }

  createContextWith(data) {
    return new _context.default(this, this.client, data);
  }

}

exports.default = SDK;