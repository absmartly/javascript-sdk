module.exports = function (api) {
	api.cache.never();

	const target = process.env.TARGET || "cjs";

	const presets = [];
	const plugins = [
		"@babel/plugin-syntax-dynamic-import",
		"@babel/plugin-syntax-import-meta",
		"@babel/plugin-proposal-class-properties",
		"@babel/plugin-proposal-export-namespace-from",
		"@babel/plugin-proposal-numeric-separator",
		"@babel/plugin-proposal-throw-expressions",
		"@babel/plugin-proposal-export-default-from",
		"@babel/plugin-proposal-logical-assignment-operators",
		"@babel/plugin-proposal-optional-chaining",
		"@babel/plugin-proposal-nullish-coalescing-operator",
	];

	const preset = [
		"@babel/preset-env",
		{
			modules: "commonjs", // transpile modules into common-js syntax by default
			targets: {},
		},
	];

	const runtime = [
		"@babel/plugin-transform-runtime",
		{
			absoluteRuntime: true,
			regenerator: false,
			useESModules: false, // don't output es-modules by default
			corejs: false,
			helpers: false,
		},
	];

	switch (target) {
		case "browser":
			Object.assign(preset[1], {
				targets: {
					ie: "10",
				},
				useBuiltIns: "usage",
				corejs: 3,
				exclude: [
					/es\.array\.(?!(find$)).*/,
					"es.array-buffer.*",
					"es.function.*",
					"es.json.*",
					/es\.math\.(?!(imul$)).*/,
					"es.map.*",
					/es\.object\.(?!(assign$|entries$)).*/,
					"es.promise.*",
					"es.regexp.*",
					"es.reflect.*",
					"es.set.*",
					"es.string.*",
					"es.symbol.*",
					/es\.typed-array\.(?!(from$|of)).*/,
					"es.weak-map.*",
					"web.*",
				],
			});
			break;

		case "cjs":
			Object.assign(preset[1], {
				targets: {
					node: "6",
				},
				useBuiltIns: "usage",
				corejs: 3,
			});
			break;

		case "mjs":
			Object.assign(runtime[1], {
				useESModules: true,
			});
			Object.assign(preset[1], {
				modules: false,
				targets: {
					node: "13.20",
				},
			});
			break;
		default:
			throw new Error(`Unsupported target '${target}'`);
	}

	presets.push(preset);
	plugins.push(runtime);

	return {
		presets,
		plugins,
	};
};
