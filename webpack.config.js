/* eslint-disable @typescript-eslint/no-var-requires */
const TerserPlugin = require("terser-webpack-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const env = process.env.NODE_ENV || "development";
const analyze = process.env.WEBPACK_ANALYZE || false;

module.exports = function () {
	const config = {
		devtool: "source-map",
		entry: {
			absmartly: ["./js/browser.js"],
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
					// rfdc >= 1.4 ships ES2015 syntax; transpile it so the bundle stays ES5 for IE 10.
					exclude: /node_modules[\\/](?!rfdc[\\/])/,
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
			maxAssetSize: 131072,
		};

		config.optimization = {
			minimize: true,
			minimizer: [new TerserPlugin()],
		};

		if (analyze) {
			config.plugins = [new BundleAnalyzerPlugin()];
		}
	} else {
		config.output.filename = "[name].js";
	}

	return config;
};
