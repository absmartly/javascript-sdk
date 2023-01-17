import Context from "./context";
import SDK from "./sdk";

export class ContextPublisher {
	publish(request: Record<string, unknown>, sdk: SDK, _: Context, requestOptions?: Record<string, unknown>) {
		return sdk.getClient().publish(request, requestOptions);
	}
}
