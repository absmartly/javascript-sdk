interface IEvent {
	type: string;
	cancelable: boolean;
	bubbles: boolean;
}

// eslint-disable-next-line no-shadow
export class AbortSignal {
	aborted = false;
	_events: { [key: string]: any[] };

	constructor() {
		this._events = {};
	}

	addEventListener(type: string, listener: any) {
		let listeners = this._events[type];
		if (!listeners) {
			listeners = [];
			this._events[type] = listeners;
		}
		listeners.push(listener);
	}

	removeEventListener(type: string, listener: any) {
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

	dispatchEvent(evt: IEvent) {
		this[`on${evt.type}`] && this[`on${evt.type}`](evt);
		const listeners = this._events[evt.type];
		if (listeners) {
			for (const listener of listeners) {
				listener.call(null, evt);
			}
		}
	}

	// eslint-disable-next-line class-methods-use-this
	toString() {
		return "[object AbortSignal]";
	}
}

// eslint-disable-next-line no-shadow
export class AbortController {
	signal = new AbortSignal();

	abort() {
		let evt: IEvent;
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

	// eslint-disable-next-line class-methods-use-this
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
