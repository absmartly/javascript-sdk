import clone from "rfdc/default";
import { Context } from ".";
import { isObject } from "./utils";

export function mergeConfig(context: Context, previousConfig: {}): {} {
	const merged: Object = clone(previousConfig);
	const keys = context.variableKeys();

	for (const [variableKey, experimentName] of Object.entries(keys)) {
		let target = merged;
		const frags = variableKey.split(".");

		for (let index = 0; index < frags.length; ++index) {
			const frag = frags[index];

			if (`_${frag}_setter` in target) {
				console.error(
					`Config key '${frags.slice(0, index + 1).join(".")}' already set by experiment '${
						target[`_${frag}_setter`]
					}'.`
				);

				target = undefined;
				break;
			}

			if (frag in target) {
				if (index < frags.length - 1) {
					if (!isObject(target[frag])) {
						console.warn(
							`Config key '${variableKey}' for experiment '${experimentName}' is overriding non-object value at '${frags
								.slice(0, index + 1)
								.join(".")}' with an object.`
						);

						target = target[frag] = {};
					} else {
						target = target[frag];
					}
				}
			}

			if (index === frags.length - 1) {
				const defaultValue = target[frag];

				Object.defineProperty(target, `_${frag}_setter`, {
					value: experimentName,
					writable: false,
				});

				Object.defineProperty(target, frag, {
					get: () => {
						return context.variableValue(variableKey, defaultValue);
					},
				});
			}
		}
	}

	return merged;
}
