import { describe, expect, test, vi } from "vitest";
import { DefaultContextDataProvider } from "../provider";

describe("DefaultContextDataProvider", () => {
	test("delegates to sdk.getClient().getContext()", async () => {
		const mockGetContext = vi.fn().mockResolvedValue({ experiments: [] });
		const mockSdk = { getClient: () => ({ getContext: mockGetContext }) };

		const provider = new DefaultContextDataProvider();
		const result = await provider.getContextData(mockSdk, { path: "/test" });

		expect(mockGetContext).toHaveBeenCalledWith({ path: "/test" });
		expect(result).toEqual({ experiments: [] });
	});
});
