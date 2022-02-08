export class ContextPublisher {
	// eslint-disable-next-line class-methods-use-this,no-unused-vars
	publish(request, sdk, context, requestOptions) {
		return sdk.getClient().publish(request, requestOptions);
	}
}
