/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	clearMocks: true,
	coverageDirectory: "coverage",
	modulePathIgnorePatterns: ["<rootDir>/.claude/"],
	testEnvironment: "node",
	testPathIgnorePatterns: ["<rootDir>/.claude/"],
	testRegex: "/__tests__/.*\\.(test|spec)\\.[t|j]sx?$",
	transform: {
		"^.+\\.[t|j]sx?$": ["ts-jest"],
	},
};
