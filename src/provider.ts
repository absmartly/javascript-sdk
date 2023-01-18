import { ClientRequestOptions } from "./types";
import SDK from "./sdk";

export class ContextDataProvider {
	getContextData(sdk: SDK, requestOptions?: ClientRequestOptions) {
		return sdk.getClient().getContext(requestOptions);
	}
}
