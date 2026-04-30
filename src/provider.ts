import SDK from "./sdk";
import { type ClientRequestOptions } from "./client";

export class ContextDataProvider {
	getContextData(sdk: SDK, requestOptions?: Partial<ClientRequestOptions>) {
		return sdk.getClient().getContext(requestOptions);
	}
}
