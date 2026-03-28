import { describe, expect, test, vi } from "vitest";
import { ContextPublisher } from "../publisher";

describe("ContextPublisher", () => {
	test("delegates to sdk.getClient().publish()", async () => {
		const mockPublish = vi.fn().mockResolvedValue({});
		const mockSdk = { getClient: () => ({ publish: mockPublish }) };
		const request = {
			units: [{ type: "session_id", uid: "abc" }],
			publishedAt: 1000,
			hashed: true,
			sdkVersion: "2.0.0",
		};

		const publisher = new ContextPublisher();
		await publisher.publish(request, mockSdk, {}, { path: "/test" });

		expect(mockPublish).toHaveBeenCalledWith(request, { path: "/test" });
	});
});
