module.exports = {
	clearMocks: true,
	coverageDirectory: "coverage",
	testEnvironment: "node",
	testRegex: "/__tests__/.*\\.(test|spec)\\.jsx?$",
	transform: {
		"^.+\\.jsx?$": "babel-jest",
	},
};
