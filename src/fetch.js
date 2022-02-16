import { isBrowser, isWorker } from "./utils";
import fetchShim from "./fetch-shim";

const exported = isBrowser()
	? window.fetch
		? window.fetch.bind(window)
		: fetchShim
	: isWorker()
	? self.fetch
		? self.fetch.bind(self)
		: fetchShim
	: global
	? global.fetch
		? global.fetch.bind(global)
		: function (url, opts) {
				return new Promise((resolve, reject) => {
					import("node-fetch")
						.then((fetchNode) => {
							fetchNode.default(url.replace(/^\/\//g, "https://"), opts).then(resolve).catch(reject);
						})
						.catch(reject);
				});
		  }
	: undefined;

export default exported;
