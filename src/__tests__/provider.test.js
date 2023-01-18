import Client from "../client";
import SDK from "../sdk";
import { ContextDataProvider } from "../provider";

jest.mock("../client");
jest.mock("../sdk");

describe("ContextDataProvider", () => {
	const client = new Client();
	const sdk = new SDK();

	sdk.getClient.mockReturnValue(client);

	describe("getContextData()", () => {
		it("should call client getContext", async () => {
			const provider = new ContextDataProvider();

			const data = {};
			client.getContext.mockReturnValue(Promise.resolve(data));

			const result = provider.getContextData(sdk);

			expect(result).toBeInstanceOf(Promise);
			expect(client.getContext).toHaveBeenCalledTimes(1);
			expect(client.getContext).toHaveBeenCalledWith(undefined);

			result.then((resp) => {
				expect(resp).toBe(data);
			});
		});

		it("should pass through options", async () => {
			const provider = new ContextDataProvider();

			const data = {};
			client.getContext.mockReturnValue(Promise.resolve(data));

			const result = provider.getContextData(sdk, { timeout: 1234 });

			expect(result).toBeInstanceOf(Promise);
			expect(client.getContext).toHaveBeenCalledTimes(1);
			expect(client.getContext).toHaveBeenCalledWith({
				timeout: 1234,
			});

			result.then((resp) => {
				expect(resp).toBe(data);
			});
		});
	});
});
