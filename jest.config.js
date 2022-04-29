module.exports = {
	clearMocks: true,
	coverageDirectory: "coverage",
	testEnvironment: "node",
	testRegex: "/__tests__/.*\\.(test|spec)\\.[t|j]sx?$",
	transform: {
		"^.+\\.[t|j]sx?$": "babel-jest",
	},
};
