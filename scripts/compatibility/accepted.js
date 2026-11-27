"use strict";

// Breaks from 1.13.4 the owner accepted for 1.14.0 (2026-11-26), each listed under CHANGELOG Changed.
// Only these exact differences pass; any other type error or runtime difference still fails the run.
const ACCEPTED_TYPE_ERRORS = [
	// `Exposure.ruleOverride` is required.
	{
		pattern: /error TS2741: Property 'ruleOverride' is missing in type '[^']*' but required in type 'Exposure'\.$/,
		count: 1,
	},
	// `ClientOptions.application.version` is `number | string`; the three released numeric readers must narrow it.
	{ pattern: /error TS2322: Type 'string \| number' is not assignable to type 'number'\.$/, count: 3 },
];
const ACCEPTED_TYPE_DETAIL = /^\s+Type 'string' is not assignable to type 'number'\.$/;
const ACCEPTED_RUNTIME_DIFFERENCES = [
	// Error strings use the `ABsmartly` brand.
	'runtime.errors.notReady.message: "ABSmartly Context is not yet ready." -> "ABsmartly Context is not yet ready."',
	'runtime.errors.finalized.message: "ABSmartly Context is finalized." -> "ABsmartly Context is finalized."',
	// Canonical UTF-8 unit hashing: sweep entry 256 is the emoji UID "😀", outside the BMP.
	'runtime.sweep.256.hash: "-Z9RwqljCn9rjBPBgYvAwg" -> "KgLqw51xanDs83V5GFkntg"',
	"runtime.sweep.256.peek: 0 -> 1",
	"runtime.sweep.256.treatment: 0 -> 1",
];
function unacceptedTypeErrors(output) {
	const counts = ACCEPTED_TYPE_ERRORS.map(() => 0);
	const rest = [];
	for (const line of output.split("\n")) {
		if (!line.trim() || ACCEPTED_TYPE_DETAIL.test(line)) continue;
		const index = ACCEPTED_TYPE_ERRORS.findIndex(({ pattern }) => pattern.test(line));
		if (index < 0) rest.push(line);
		else counts[index]++;
	}
	ACCEPTED_TYPE_ERRORS.forEach(({ pattern, count }, i) => {
		if (counts[i] !== count)
			rest.push(`expected ${count} accepted error(s) matching ${pattern}, found ${counts[i]}`);
	});
	return rest;
}

module.exports = { ACCEPTED_TYPE_ERRORS, ACCEPTED_RUNTIME_DIFFERENCES, unacceptedTypeErrors };
