import { Client } from "@absmartly/javascript-client";
import Context from "./context";
export default class SDK {
  constructor(options) {
    options = Object.assign({
      agent: "javascript-sdk"
    }, options);
    this.client = new Client(options);
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
    return new Context(this, this.client, options, data);
  }

  createContextWith(data, options) {
    options = SDK._contextOptions(options);
    return new Context(this, this.client, options, data);
  }

  static _contextOptions(options) {
    const isBrowser = typeof window !== "undefined" && typeof window.navigator !== "undefined";
    return Object.assign({
      publishDelay: isBrowser ? 200 : -1
    }, options || {});
  }

}