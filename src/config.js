import clone from "rfdc/default";

export function mergeConfig(context, previousConfig) {
	const merged = clone(previousConfig);
	const experiments = context.experiments();

	const isObject = (x) => x instanceof Object && x.constructor === Object;

	for (const experimentName of experiments) {
		const experimentConfig = context.experimentConfig(experimentName);
		for (const [configKey, configValue] of Object.entries(experimentConfig)) {
			let target = merged;
			let key = configKey;

			if (key.indexOf(".") !== -1) {
				const frags = key.split(".");
				key = frags.pop();

				for (const index in frags) {
					const frag = frags[index];

					if (frag in target) {
						if (isObject(target[frag])) {
							target = target[frag];
						} else {
							console.warn(
								`Config key '${configKey}' for experiment '${experimentName}' is overriding non-object value at '${frags
									.slice(0, index + 1)
									.join(".")}' with an object.`
							);

							target = target[frag] = {};
						}
					} else {
						target = target[frag] = {};
					}
				}
			}

			if (key in target && `_${key}_setter` in target) {
				console.error(`Config key '${configKey}' already set by experiment '${target[`_${key}_setter`]}'.`);
			} else {
				Object.defineProperty(target, `_${key}_setter`, {
					value: experimentName,
					writable: false,
				});

				if (key in target) {
					if (isObject(target[key]) && !isObject(configValue)) {
						console.warn(
							`Config key '${configKey}' for experiment '${experimentName}' is overriding object with non-object value.`
						);
					} else if (!isObject(target[key]) && isObject(configValue)) {
						console.warn(
							`Config key '${configKey}' for experiment '${experimentName}' is overriding non-object value with object.`
						);
					}
				}

				Object.defineProperty(target, key, {
					get: () => {
						context.treatment(experimentName);
						return configValue;
					},
				});
			}
		}
	}

	return merged;
}
