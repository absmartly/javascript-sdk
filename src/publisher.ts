import { Context, SDK } from ".";
import { IRequest } from "./types";

export class ContextPublisher {
	// eslint-disable-next-line class-methods-use-this,no-unused-vars
	publish(request: IRequest, sdk: SDK, context: Context, requestOptions?: any): Promise<any> {
		return sdk.getClient().publish(request, requestOptions);
	}
}
