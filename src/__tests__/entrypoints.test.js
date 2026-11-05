import indexDefault, { ABsmartly, SDK } from "../index";
import browserDefault from "../browser";

// Guards against the two declared package entry points (CommonJS/ES via
// `src/index.ts`, and the UMD build via `src/browser.ts`) drifting apart:
// `browser.ts` previously omitted a public API addition (the `ABsmartly`
// alias) that `index.ts` had, so `require("dist/absmartly.js").ABsmartly`
// was `undefined` in the built UMD artifact while the CJS/ES entry worked.
describe("entry point parity", () => {
	it("should expose the same public API keys from index and browser default exports", () => {
		expect(Object.keys(browserDefault).sort()).toEqual(Object.keys(indexDefault).sort());
	});

	it("should expose ABsmartly as an alias for SDK from both entry points", () => {
		expect(ABsmartly).toBe(SDK);
		expect(indexDefault.ABsmartly).toBe(indexDefault.SDK);
		expect(browserDefault.ABsmartly).toBe(browserDefault.SDK);
	});
});
