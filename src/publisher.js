export class ContextPublisher {
	// eslint-disable-next-line no-unused-vars
	publish(request, sdk, context, requestOptions) {
		return sdk.getClient().publish(request, requestOptions);
	}
}
