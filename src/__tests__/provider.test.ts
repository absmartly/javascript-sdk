import { describe, expect, test, vi } from "vitest";
import { ContextDataProvider } from "../provider";

describe("ContextDataProvider", () => {
	test("delegates to sdk.getClient().getContext()", async () => {
		const mockGetContext = vi.fn().mockResolvedValue({ experiments: [] });
		const mockSdk = { getClient: () => ({ getContext: mockGetContext }) };

		const provider = new ContextDataProvider();
		const result = await provider.getContextData(mockSdk, { path: "/test" });

		expect(mockGetContext).toHaveBeenCalledWith({ path: "/test" });
		expect(result).toEqual({ experiments: [] });
	});
});
