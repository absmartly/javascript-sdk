import { ClientRequestOptions } from "./types";
import SDK from "./sdk";

export class ContextDataProvider {
	getContextData(sdk: SDK, requestOptions?: Partial<ClientRequestOptions>) {
		return sdk.getClient().getContext(requestOptions);
	}
}
