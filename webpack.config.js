const TerserPlugin = require("terser-webpack-plugin");
const env = process.env.NODE_ENV || "development";

module.exports = function () {
	const config = {
		devtool: "source-map",
		entry: {
			absmartly: ["./src/browser.js"],
		},

		target: "browserslist",

		output: {
			library: "absmartly",
			libraryTarget: "umd",
			libraryExport: "default",
		},

		module: {
			rules: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: ["babel-loader"],
				},
			],
		},

		mode: env,
	};

	if (env === "production") {
		config.output.filename = "[name].min.js";
		config.performance = {
			hints: "error",
			maxAssetSize: 51200,
		};

		config.optimization = {
			minimize: true,
			minimizer: [new TerserPlugin()],
		};
	} else {
		config.output.filename = "[name].js";
	}

	return config;
};
