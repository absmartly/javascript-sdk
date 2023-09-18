import { isBrowser, isWorker } from "./utils";
import AbortControllerShim from "./abort-controller-shim";

// eslint-disable-next-line no-shadow
export const AbortController =
	isBrowser() && window.AbortController
		? window.AbortController
		: isWorker() && self.AbortController
		? self.AbortController
		: global && global.AbortController
		? global.AbortController
		: AbortControllerShim;
