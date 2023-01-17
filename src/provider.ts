import SDK from "./sdk";

export class ContextDataProvider {
	getContextData(sdk: SDK, requestOptions?: Record<string, unknown>) {
		return sdk.getClient().getContext(requestOptions);
	}
}
