export class ContextDataProvider {
	getContextData(sdk, requestOptions) {
		return sdk.getClient().getContext(requestOptions);
	}
}
