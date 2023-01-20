import Context from "./context";
import SDK from "./sdk";
import { ClientRequestOptions, PublishParams } from "./types";

export class ContextPublisher {
	publish(request: PublishParams, sdk: SDK, _: Context, requestOptions?: ClientRequestOptions) {
		return sdk.getClient().publish(request, requestOptions);
	}
}
