import SDK from "../sdk";
import Client from "../client";

// Included in tsc: ConstructorParameters uses the final overload, which must remain the released type.
export function sdkApplicationVersion(options: ConstructorParameters<typeof SDK>[0]): number {
	return typeof options.application === "string" ? 0 : options.application.version;
}

export function clientApplicationVersion(options: ConstructorParameters<typeof Client>[0]): number {
	return typeof options.application === "string" ? 0 : options.application.version;
}

import { getApplicationVersion } from "../utils";
export function releasedUtilityReturnType(value: ReturnType<typeof getApplicationVersion>): number {
	return value + 1;
}

export const releasedDirectUtilityTypes: [number, number, number | string] = [
	getApplicationVersion("web"),
	getApplicationVersion({ name: "web", version: 3 }),
	getApplicationVersion({ name: "web", version: "1.2.3" }),
];
