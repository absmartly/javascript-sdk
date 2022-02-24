const { defaults } = require("jest-config");

module.exports = {
	clearMocks: true,
	coverageDirectory: "coverage",
	testEnvironment: "node",
	transform: {
		"^.+\\.[t|j]sx?$": "babel-jest",
	},
	moduleFileExtensions: [...defaults.moduleFileExtensions, "ts", "tsx"],
};
