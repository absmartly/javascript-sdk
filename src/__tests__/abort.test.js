import { Aborter, Signal } from "../abort";

describe("Signal", () => {
	const expectedEvent = expect.objectContaining({
		type: expect.any(String),
		cancelable: false,
		bubbles: false,
	});

	describe("dispatchEvent", () => {
		it("calls listeners", async (done) => {
			const aborter = new Aborter();
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

			done();
		});
	});
});

describe("Aborter", () => {
	it("creates abort signal", async (done) => {
		const aborter = new Aborter();
		expect(aborter.signal).toBeInstanceOf(Signal);

		done();
	});

	it("abort dispatches event on signal", async (done) => {
		const aborter = new Aborter();
		jest.spyOn(aborter.signal, "dispatchEvent").mockImplementation(() => {});

		aborter.abort();

		expect(aborter.signal.dispatchEvent).toHaveBeenCalledTimes(1);
		expect(aborter.signal.dispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: expect.any(String) })
		);

		done();
	});
});
