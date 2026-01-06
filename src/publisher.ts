import Context, { Attribute, Exposure, Goal, Unit } from "./context";
import SDK from "./sdk";
import { ClientRequestOptions } from "./client";

export type PublishParams = {
	units: Unit[];
	publishedAt: number;
	hashed: boolean;
	attributes?: Attribute[];
	goals?: Goal[];
	exposures?: Exposure[];
};

export type PublishOptions = ClientRequestOptions & {
	useBeacon?: boolean;
};

export class ContextPublisher {
	publish(request: PublishParams, sdk: SDK, _: Context, requestOptions?: PublishOptions) {
		if (requestOptions?.useBeacon) {
			const success = sdk.getClient().publishBeacon(request);
			if (success) {
				return Promise.resolve();
			}
		}
		return sdk.getClient().publish(request, requestOptions);
	}
}
