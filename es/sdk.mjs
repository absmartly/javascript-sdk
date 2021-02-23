function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import { Client } from "@absmartly/javascript-client";
import Context from "./context";
export default class SDK {
  constructor(options) {
    const clientOptions = Object.assign({
      agent: "absmartly-javascript-sdk"
    }, ...Object.entries(options || {}).filter(x => ["application", "agent", "apiKey", "endpoint", "environment", "timeout"].indexOf(x[0]) !== -1).map(x => ({
      [x[0]]: x[1]
    })));
    options = Object.assign({}, {
      eventLogger: SDK.defaultEventLogger
    }, options);
    this._eventLogger = options.eventLogger;
    this._client = new Client(clientOptions);
  }

  createContext(params, options) {
    const transformed = Object.assign({}, {
      units: Object.keys(params.units).map(type => ({
        type,
        uid: params.units[type]
      }))
    });
    options = this._contextOptions(options);

    const data = this._client.createContext(transformed);

    return new Context(this, this._client, options, data);
  }

  setEventLogger(logger) {
    this._eventLogger = logger;
  }

  getEventLogger() {
    return this._eventLogger;
  }

  getClient() {
    return this._client;
  }

  createContextWith(data, options) {
    options = this._contextOptions(options);
    return new Context(this, this._client, options, data);
  }

  _contextOptions(options) {
    const isBrowser = typeof window !== "undefined" && typeof window.navigator !== "undefined";
    return Object.assign({
      publishDelay: isBrowser ? 100 : -1,
      eventLogger: this.getEventLogger()
    }, options || {});
  }

}

_defineProperty(SDK, "defaultEventLogger", (context, eventName, data) => {
  if (eventName === "error") {
    console.error(data);
  }
});