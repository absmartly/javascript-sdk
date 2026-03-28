import type { ClientRequestOptions, ContextData } from "./types";

interface SDKLike {
	getClient(): { getContext(options?: Partial<ClientRequestOptions>): Promise<ContextData> };
}

export class ContextDataProvider {
	getContextData(sdk: SDKLike, requestOptions?: Partial<ClientRequestOptions>): Promise<ContextData> {
		return sdk.getClient().getContext(requestOptions) as Promise<ContextData>;
	}
}
