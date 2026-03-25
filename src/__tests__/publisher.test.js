import Client from "../client";
import SDK from "../sdk";
import Context from "../context";
import { ContextPublisher } from "../publisher";

jest.mock("../client");
jest.mock("../sdk");
jest.mock("../context");

describe("ContextPublisher", () => {
	const client = new Client();
	const sdk = new SDK();
	const context = new Context();

	sdk.getClient.mockReturnValue(client);

	describe("publish()", () => {
		it("should call client publish", async () => {
			const publisher = new ContextPublisher();

			const data = { ok: true };
			client.publish.mockReturnValue(Promise.resolve(data));

			const request = { test: 1 };
			const result = publisher.publish(request, sdk, context);

			expect(result).toBeInstanceOf(Promise);
			expect(client.publish).toHaveBeenCalledTimes(1);
			expect(client.publish).toHaveBeenCalledWith(request, undefined);

			result.then((resp) => {
				expect(resp).toBe(data);
			});
		});

		it("should pass through options", async () => {
			const publisher = new ContextPublisher();

			const data = { ok: true };
			client.publish.mockReturnValue(Promise.resolve(data));

			const request = { test: 1 };
			const result = publisher.publish(request, sdk, context, { timeout: 1234 });

			expect(result).toBeInstanceOf(Promise);
			expect(client.publish).toHaveBeenCalledTimes(1);
			expect(client.publish).toHaveBeenCalledWith(request, {
				timeout: 1234,
			});

			result.then((resp) => {
				expect(resp).toBe(data);
			});
		});

		it("should use publishBeacon when useBeacon is true and beacon succeeds", async () => {
			const publisher = new ContextPublisher();

			client.publishBeacon.mockReturnValue(true);

			const request = { test: 1 };
			const result = await publisher.publish(request, sdk, context, { useBeacon: true });

			expect(client.publishBeacon).toHaveBeenCalledTimes(1);
			expect(client.publishBeacon).toHaveBeenCalledWith(request);
			expect(client.publish).not.toHaveBeenCalled();
			expect(result).toBeUndefined();
		});

		it("should fallback to regular publish when useBeacon is true but beacon fails", async () => {
			const publisher = new ContextPublisher();

			const data = { ok: true };
			client.publishBeacon.mockReturnValue(false);
			client.publish.mockReturnValue(Promise.resolve(data));

			const request = { test: 1 };
			const result = publisher.publish(request, sdk, context, { useBeacon: true, timeout: 1234 });

			expect(client.publishBeacon).toHaveBeenCalledTimes(1);
			expect(client.publishBeacon).toHaveBeenCalledWith(request);
			expect(result).toBeInstanceOf(Promise);
			expect(client.publish).toHaveBeenCalledTimes(1);
			expect(client.publish).toHaveBeenCalledWith(request, { useBeacon: true, timeout: 1234 });

			const resp = await result;
			expect(resp).toBe(data);
		});

		it("should use regular publish when useBeacon is false", async () => {
			const publisher = new ContextPublisher();

			const data = { ok: true };
			client.publish.mockReturnValue(Promise.resolve(data));

			const request = { test: 1 };
			const result = publisher.publish(request, sdk, context, { useBeacon: false });

			expect(client.publishBeacon).not.toHaveBeenCalled();
			expect(result).toBeInstanceOf(Promise);
			expect(client.publish).toHaveBeenCalledTimes(1);
			expect(client.publish).toHaveBeenCalledWith(request, { useBeacon: false });

			result.then((resp) => {
				expect(resp).toBe(data);
			});
		});

		it("should use regular publish when useBeacon is not specified", async () => {
			const publisher = new ContextPublisher();

			const data = { ok: true };
			client.publish.mockReturnValue(Promise.resolve(data));

			const request = { test: 1 };
			const result = publisher.publish(request, sdk, context);

			expect(client.publishBeacon).not.toHaveBeenCalled();
			expect(result).toBeInstanceOf(Promise);
			expect(client.publish).toHaveBeenCalledTimes(1);
			expect(client.publish).toHaveBeenCalledWith(request, undefined);

			result.then((resp) => {
				expect(resp).toBe(data);
			});
		});
	});
});
