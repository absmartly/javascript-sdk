import type { ClientRequestOptions, PublishParams } from "./types";

interface SDKLike {
	getClient(): { publish(request: PublishParams, options?: ClientRequestOptions): Promise<unknown> };
}

export class ContextPublisher {
	publish(request: PublishParams, sdk: SDKLike, _context: unknown, requestOptions?: ClientRequestOptions): Promise<unknown> {
		return sdk.getClient().publish(request, requestOptions);
	}
}
