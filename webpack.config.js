const env = process.env.NODE_ENV || "development";

module.exports = function () {
	const config = {
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
		config.output.filename = `[name].min.js`;
		config.performance = {
			hints: "error",
			maxAssetSize: 16384,
		};
	} else {
		config.output.filename = `[name].js`;
	}

	return config;
};
