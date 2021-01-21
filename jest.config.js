module.exports = {
	clearMocks: true,
	coverageDirectory: "coverage",
	testEnvironment: "node",
	transform: {
		"^.+\\.[t|j]sx?$": "babel-jest",
	},
};
