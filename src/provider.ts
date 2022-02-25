import { SDK } from ".";

export class ContextDataProvider {
	// eslint-disable-next-line class-methods-use-this
	getContextData(sdk: SDK, requestOptions?: any): Promise<any> {
		return sdk.getClient().getContext(requestOptions);
	}
}
