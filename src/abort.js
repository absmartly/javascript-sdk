// eslint-disable-next-line no-shadow
export class Signal {
	constructor() {
		this._events = {};
	}

	addEventListener(type, listener) {
		let listeners = this._events[type];
		if (!listeners) {
			listeners = [];
			this._events[type] = listeners;
		}
		listeners.push(listener);
	}

	removeEventListener(type, listener) {
		const listeners = this._events[type];
		if (listeners) {
			const index = listeners.find((x) => x === listener);
			if (index !== -1) {
				listeners.splice(index, 1);
				if (listeners.length === 0) {
					delete this._events[type];
				}
			}
		}
	}

	dispatchEvent(evt) {
		this[`on${evt.type}`] && this[`on${evt.type}`](evt);
		const listeners = this._events[evt.type];
		if (listeners) {
			for (const listener of listeners) {
				listener.call(null, evt);
			}
		}
	}
}

// eslint-disable-next-line no-shadow
export class Aborter {
	signal = new Signal();

	abort() {
		let evt;
		try {
			evt = new Event("abort");
		} catch (e) {
			evt = {
				type: "abort",
				bubbles: false,
				cancelable: false,
			};
		}

		this.signal.dispatchEvent(evt);
	}
}

// eslint-disable-next-line no-shadow
export const AbortController = (() => {
	const native = typeof window !== "undefined" ? window : global;
	return native?.AbortController ?? Aborter;
})();
