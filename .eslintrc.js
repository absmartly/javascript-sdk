module.exports = {
	root: true,
	parser: "@babel/eslint-parser",
	env: {
		browser: true,
		node: true,
		es6: true,
		jest: true,
	},
	extends: ["eslint:recommended", "prettier"],
	rules: {
		"no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
		"no-template-curly-in-string": "error",
		"no-promise-executor-return": "error",
		"no-useless-backreference": "error",
		//		"require-atomic-updates": "error",
		"array-callback-return": "error",
		"block-scoped-var": "error",
		"class-methods-use-this": "error",
		"consistent-return": "error",
		"default-case": ["error", { commentPattern: "^skip|no\\s+default" }],
		"default-param-last": "error",
		"dot-location": ["error", "property"],
		eqeqeq: ["error", "smart"],
		"no-alert": "error",
		"no-constructor-return": "error",
		"no-else-return": "error",
		"no-extend-native": "error",
		"no-extra-label": "error",
		"no-invalid-this": "error",
		"no-loop-func": "error",
		"no-return-assign": "error",
		"no-return-await": "error",
		"no-self-compare": "error",
		"no-sequences": "error",
		"no-throw-literal": "error",
		"no-useless-concat": "error",
		"no-useless-return": "error",
		"no-void": "error",
		"wrap-iife": ["error", "inside"],
		"no-shadow": ["error", { builtinGlobals: true, hoist: "never" }],
		"no-use-before-define": "error",
		"no-var": "error",
		"prefer-numeric-literals": "error",
		"prefer-const": "warn",
		"prefer-arrow-callback": "error",
		"prefer-rest-params": "error",
		"prefer-spread": "error",
		"prefer-template": "error",
	},
};