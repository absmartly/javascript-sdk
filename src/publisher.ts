import { Context, SDK } from ".";
import { IRequest } from "./types";

export class ContextPublisher {
	publish(request: any, sdk: SDK, context: Context, requestOptions?: any): Promise<any> {
		return sdk.getClient().publish(request, requestOptions);
	}
}
