import type { ContextData } from "./models";
import type { ClientRequestOptions, ContextDataProvider } from "./interfaces";

interface SDKLike {
	getClient(): { getContext(options?: Partial<ClientRequestOptions>): Promise<ContextData> };
}

export class DefaultContextDataProvider implements ContextDataProvider {
	getContextData(sdk: SDKLike, requestOptions?: Partial<ClientRequestOptions>): Promise<ContextData> {
		return sdk.getClient().getContext(requestOptions) as Promise<ContextData>;
	}
}
