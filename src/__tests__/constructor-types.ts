import SDK from "../sdk";
import Client from "../client";

// Included in tsc: ConstructorParameters uses the final overload, which must remain the released type.
export function sdkApplicationVersion(options: ConstructorParameters<typeof SDK>[0]): number {
	return typeof options.application === "string" ? 0 : options.application.version;
}

export function clientApplicationVersion(options: ConstructorParameters<typeof Client>[0]): number {
	return typeof options.application === "string" ? 0 : options.application.version;
}
