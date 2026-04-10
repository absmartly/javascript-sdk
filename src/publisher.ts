import type { PublishParams } from "./models";
import type { ClientRequestOptions, ContextPublisher } from "./interfaces";

interface SDKLike {
	getClient(): { publish(request: PublishParams, options?: ClientRequestOptions): Promise<unknown> };
}

export class DefaultContextPublisher implements ContextPublisher {
	publish(request: PublishParams, sdk: SDKLike, _context: unknown, requestOptions?: ClientRequestOptions): Promise<unknown> {
		return sdk.getClient().publish(request, requestOptions);
	}
}
