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
	: globalThis
	? globalThis.fetch
		? globalThis.fetch.bind(globalThis)
		: function (url: string, opts: any) {
				return new Promise((resolve, reject) => {
					import("node-fetch")
						.then((fetchNode) => {
							return fetchNode.default(url.replace(/^\/\//g, "https://"), opts).then(resolve).catch(reject);
						})
						.catch(reject);
				});
		  }
	: undefined;

export default exported;
