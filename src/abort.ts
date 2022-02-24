import { isBrowser, isWorker } from "./utils";
import AbortControllerShim from "./abort-controller-shim";

interface IAbortController {
	new (): AbortController;
	prototype: AbortController;
}

export const AbortController: IAbortController | typeof AbortControllerShim =
	isBrowser() && window.AbortController
		? window.AbortController
		: isWorker() && self.AbortController
		? self.AbortController
		: global && global.AbortController
		? global.AbortController
		: AbortControllerShim;
