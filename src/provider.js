export class ContextDataProvider {
	// eslint-disable-next-line class-methods-use-this
	getContextData(sdk, requestOptions) {
		return sdk.getClient().getContext(requestOptions);
	}
}
