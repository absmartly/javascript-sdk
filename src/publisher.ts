import Context, { Attribute, Exposure, Goal, Unit } from "./context";
import SDK from "./sdk";
import { ClientRequestOptions } from "./client";

export type PublishParams = {
	units: Unit[];
	publishedAt: number;
	hashed: boolean;
	sdkVersion?: string;
	attributes?: Attribute[];
	goals?: Goal[];
	exposures?: Exposure[];
};

export class ContextPublisher {
	publish(request: PublishParams, sdk: SDK, _: Context, requestOptions?: ClientRequestOptions) {
		return sdk.getClient().publish(request, requestOptions);
	}
}
