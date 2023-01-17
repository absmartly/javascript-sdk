const TerserPlugin = require("terser-webpack-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const env = process.env.NODE_ENV || "development";
const analyze = process.env.WEBPACK_ANALYZE || false;

module.exports = function () {
	const config = {
		devtool: "source-map",
		entry: {
			absmartly: ["./src/browser.ts"],
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
					test: /\.[jt]s$/,
					exclude: /node_modules/,
					use: [
						{
							loader: "babel-loader",
							options: { presets: ["@babel/preset-env", "@babel/preset-typescript"] },
						},
					],
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
