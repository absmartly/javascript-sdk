import { isBrowser, isWorker } from "./utils";
import AbortControllerShim from "./abort-controller-shim";

export const AbortController =
	isBrowser() && window.AbortController
		? window.AbortController
		: isWorker() && self.AbortController
		? self.AbortController
		: global && global.AbortController
		? global.AbortController
		: AbortControllerShim;
