import { isLongLivedApp, isWorker } from "./utils";
import fetchShim from "./fetch-shim";

function getFetchImplementation() {
	if (isLongLivedApp()) {
		if (window.fetch) {
			return window.fetch.bind(window);
		}
		return fetchShim;
	}

	if (isWorker()) {
		if (self.fetch) {
			return self.fetch.bind(self);
		}
		return fetchShim;
	}

	if (global) {
		if (global.fetch) {
			return global.fetch.bind(global);
		}
		return function (url: string, opts: Record<string, unknown>) {
			return new Promise((resolve, reject) => {
				import("node-fetch")
					.then((fetchNode) => {
						fetchNode.default(url.replace(/^\/\//g, "https://"), opts).then(resolve).catch(reject);
					})
					.catch(reject);
			});
		};
	}

	return undefined;
}

const exported = getFetchImplementation();

export default exported;
