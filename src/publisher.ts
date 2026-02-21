import Context, { type Attribute, type Exposure, type Goal, type Unit } from "./context";
import SDK from "./sdk";
import { type ClientRequestOptions } from "./client";

export type PublishParams = {
	units: Unit[];
	publishedAt: number;
	hashed: boolean;
	attributes?: Attribute[];
	goals?: Goal[];
	exposures?: Exposure[];
};

export class ContextPublisher {
	publish(request: PublishParams, sdk: SDK, _: Context, requestOptions?: ClientRequestOptions) {
		return sdk.getClient().publish(request, requestOptions);
	}
}
