import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/version.ts"],
			reporter: ["text", "html", "lcov"],
			thresholds: {
				lines: 90,
				statements: 90,
				functions: 90,
				branches: 85,
			},
		},
	},
});
