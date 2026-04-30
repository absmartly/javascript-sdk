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

	const globalObj = typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : undefined;

	if (globalObj !== undefined) {
		if ((globalObj as Record<string, unknown>).fetch) {
			return ((globalObj as Record<string, unknown>).fetch as (...args: unknown[]) => unknown).bind(globalObj);
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

const impl = getFetchImplementation();

const exported =
	impl ??
	function () {
		throw new Error("No fetch implementation found. Please provide a fetch polyfill for your environment.");
	};

export default exported;
