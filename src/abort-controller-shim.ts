export type AbortControllerEvents = {
	[key: string]: Array<() => unknown>;
};

// eslint-disable-next-line no-shadow
export class AbortSignal {
	aborted = false;
	reason: unknown = undefined;
	onabort?: ((evt: { type: string }) => void) | null;
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
		if (evt.type === "abort" && this.onabort) {
			this.onabort(evt);
		}
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

	abort(reason?: unknown) {
		let evt: Event | { type: string; bubbles: boolean; cancelable: boolean };
		try {
			evt = new Event("abort");
		} catch (error) {
			evt = {
				type: "abort",
				bubbles: false,
				cancelable: false,
			};
		}

		this.signal.aborted = true;
		this.signal.reason = reason ?? new Error("The operation was aborted.");
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
