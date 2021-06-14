export class ContextDataProvider {
	// eslint-disable-next-line class-methods-use-this
	getContextData(sdk) {
		return sdk.getClient().getContext();
	}
}
