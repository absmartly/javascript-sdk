export type AbortControllerEvents = {
	[key: string]: Array<() => unknown>;
};

// eslint-disable-next-line no-shadow
export class AbortSignal {
	aborted = false;
	private readonly _events: AbortControllerEvents;

	constructor() {
		this._events = {};
	}

	addEventListener(type: string, listener: () => void) {
		let listeners = this._events[type];
		if (!listeners) {
			listeners = [];
			this._events[type] = listeners;
		}
		listeners.push(listener);
	}

	removeEventListener(type: string, listener: () => void) {
		const listeners = this._events[type];
		if (listeners) {
			const index = listeners.findIndex((x) => x === listener);
			if (index !== -1) {
				listeners.splice(index, 1);
				if (listeners.length === 0) {
					delete this._events[type];
				}
			}
		}
	}

	dispatchEvent(evt: { type: string }) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		this[`on${evt.type}`] && this[`on${evt.type}`](evt);
		const listeners = this._events[evt.type];
		if (listeners) {
			for (const listener of listeners) {
				listener.call(null, evt);
			}
		}
	}

	toString() {
		return "[object AbortSignal]";
	}
}

// eslint-disable-next-line no-shadow
export class AbortController {
	signal = new AbortSignal();

	abort() {
		let evt: Event | { type: string; bubbles: boolean; cancelable: boolean };
		try {
			evt = new Event("abort");
		} catch (e) {
			evt = {
				type: "abort",
				bubbles: false,
				cancelable: false,
			};
		}

		this.signal.aborted = true;
		this.signal.dispatchEvent(evt);
	}

	toString() {
		return "[object AbortController]";
	}
}

if (typeof Symbol !== "undefined" && Symbol.toStringTag !== undefined) {
	Object.defineProperty(AbortSignal.prototype, Symbol.toStringTag, {
		configurable: true,
		value: "AbortSignal",
	});

	Object.defineProperty(AbortController.prototype, Symbol.toStringTag, {
		configurable: true,
		value: "AbortController",
	});
}

export default AbortController;
