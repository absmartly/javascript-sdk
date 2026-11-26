import SDK from "../sdk";
import Client from "../client";
import { getApplicationVersion } from "../utils";

// Compile-time pins for the 1.14.0 public types: application.version accepts a number or a string.
export function sdkApplicationVersion(options: ConstructorParameters<typeof SDK>[0]): number | string {
	return typeof options.application === "string" ? 0 : options.application.version;
}

export function clientApplicationVersion(options: ConstructorParameters<typeof Client>[0]): number | string {
	return typeof options.application === "string" ? 0 : options.application.version;
}

export const stringApplicationVersions = [
	new SDK({ endpoint: "e", apiKey: "k", environment: "p", application: { name: "web", version: "1.2.3" } }),
	new Client({ endpoint: "e", apiKey: "k", environment: "p", application: { name: "web", version: "1.2.3" } }),
];

export const directUtilityTypes: [number | string, number | string] = [
	getApplicationVersion("web"),
	getApplicationVersion({ name: "web", version: "1.2.3" }),
];
