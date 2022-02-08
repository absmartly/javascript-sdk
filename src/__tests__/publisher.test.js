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
		it("should call client publish", async (done) => {
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
				done();
			});
		});

		it("should pass through options", async (done) => {
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
				done();
			});
		});
	});
});
