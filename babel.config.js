module.exports = function (api) {
	api.cache.never();

	let target = process.env.TARGET || "cjs";

	let presets = [];
	let plugins = [
		"@babel/plugin-syntax-dynamic-import",
		"@babel/plugin-syntax-import-meta",
		"@babel/plugin-proposal-class-properties",
		"@babel/plugin-proposal-json-strings",
		[
			"@babel/plugin-proposal-decorators",
			{
				legacy: true,
			},
		],
		"@babel/plugin-proposal-function-sent",
		"@babel/plugin-proposal-export-namespace-from",
		"@babel/plugin-proposal-numeric-separator",
		"@babel/plugin-proposal-throw-expressions",
		"@babel/plugin-proposal-export-default-from",
		"@babel/plugin-proposal-logical-assignment-operators",
		"@babel/plugin-proposal-optional-chaining",
		[
			"@babel/plugin-proposal-pipeline-operator",
			{
				proposal: "minimal",
			},
		],
		"@babel/plugin-proposal-nullish-coalescing-operator",
		"@babel/plugin-proposal-do-expressions",
		"@babel/plugin-proposal-function-bind",
	];

	let presetEnv = [
		"@babel/preset-env",
		{
			useBuiltIns: false,
			modules: "commonjs", // transpile modules into common-js syntax by default
			targets: {},
		},
	];

	let transformRuntime = [
		"@babel/plugin-transform-runtime",
		{
			useESModules: false, // don't output es-modules by default
			corejs: false,
			helpers: false,
		},
	];

	switch (target) {
		case "browser":
			presetEnv[1].targets["ie"] = 10;
			presets.push(presetEnv);
			plugins.push(transformRuntime);
			break;
		case "cjs":
			presetEnv[1].targets["node"] = 6;
			presets.push(presetEnv);
			plugins.push(transformRuntime);
			break;
		case "mjs":
			presetEnv[1].targets["node"] = "13.20";
			presetEnv[1].modules = false; // don't transpile module syntax
			transformRuntime[1].useESModules = true;

			presets.push(presetEnv);
			plugins.push(transformRuntime);
			break;
		default:
			throw new Error(`Unsupported target '${target}'`);
	}

	return {
		presets,
		plugins,
	};
};
