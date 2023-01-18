// eslint-disable-next-line no-shadow
import { AbortController, AbortSignal } from "../abort-controller-shim";

describe("AbortSignal", () => {
	const expectedEvent = expect.objectContaining({
		type: expect.any(String),
		cancelable: false,
		bubbles: false,
	});

	describe("dispatchEvent", () => {
		it("calls listeners", async () => {
			const aborter = new AbortController();
			const signal = aborter.signal;
			const listener1 = jest.fn();
			const listener2 = jest.fn();
			const listener3 = jest.fn();
			signal.onabort = listener3;
			signal.addEventListener("abort", listener1);
			signal.addEventListener("abort", listener2);
			signal.dispatchEvent({ type: "abort", cancelable: false, bubbles: false });

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener1).toHaveBeenCalledWith(expectedEvent);

			expect(listener2).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledWith(expectedEvent);

			expect(listener3).toHaveBeenCalledTimes(1);
			expect(listener3).toHaveBeenCalledWith(expectedEvent);

			signal.removeEventListener("abort", listener1);
			signal.removeEventListener("abort", listener2);

			listener1.mockClear();
			listener2.mockClear();
			listener3.mockClear();

			signal.dispatchEvent({ type: "abort", cancelable: false, bubbles: false });

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).not.toHaveBeenCalled();
			expect(listener3).toHaveBeenCalledTimes(1);
		});
	});

	it("toString() returns [object AbortSignal]", async () => {
		const aborter = new AbortSignal();

		expect(aborter.toString()).toEqual("[object AbortSignal]");
	});

	it("toStringTag is set to AbortSignal", async () => {
		const aborter = new AbortSignal();

		expect(aborter[Symbol.toStringTag]).toEqual("AbortSignal");
	});
});

describe("AbortController", () => {
	it("creates abort signal", async () => {
		const aborter = new AbortController();
		expect(aborter.signal).toBeInstanceOf(AbortSignal);
		expect(aborter.signal.aborted).toBe(false);
	});

	it("abort dispatches event on signal and aborted is set", async () => {
		const aborter = new AbortController();
		jest.spyOn(aborter.signal, "dispatchEvent").mockImplementation(() => {});

		aborter.abort();

		expect(aborter.signal.aborted).toBe(true);
		expect(aborter.signal.dispatchEvent).toHaveBeenCalledTimes(1);
		expect(aborter.signal.dispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: expect.any(String) })
		);
	});

	it("toString() returns [object AbortController]", async () => {
		const aborter = new AbortController();

		expect(aborter.toString()).toEqual("[object AbortController]");
	});

	it("toStringTag is set to AbortController", async () => {
		const aborter = new AbortController();

		expect(aborter[Symbol.toStringTag]).toEqual("AbortController");
	});
});
