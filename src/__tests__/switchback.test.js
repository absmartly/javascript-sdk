import { assignSwitchback, parseInt64, switchbackPermutation } from "../switchback-long";
import {
	assignSwitchbackPeriod,
	parseSwitchbackPath,
	resolveSwitchbackPath,
	resolveSwitchbackServing,
	sameSwitchbackIdentity,
	switchbackClusterKey,
	switchbackPeriodIndex,
	switchbackSources,
	tryParseInt,
	SWITCHBACK_ABSENT,
	SWITCHBACK_ELIGIBLE,
	SWITCHBACK_INELIGIBLE,
} from "../switchback";
import { hashUnit } from "../utils";

// Fixture copied byte-for-byte from absmartly/abs 9bd2b5ca35
// lib/utils/src/test/resources/switchback/golden-vectors.json (git blob b314abeb9e97).
import goldenVectors from "./fixtures/switchback/golden-vectors.json";
// Fixture copied byte-for-byte from absmartly/abs 9bd2b5ca35
// collector/src/test/resources/switchback/attribute-path-cases.json (git blob 7b1d3fed5985).
import pathCases from "./fixtures/switchback/attribute-path-cases.json";

const LONG_MIN = "-9223372036854775808";
const LONG_MAX = "9223372036854775807";

// The platform hashes a numeric cluster unit as Long.toString(n); strings pass through.
function clusterUnit(value) {
	if (typeof value === "number") {
		expect(Number.isSafeInteger(value)).toBe(true);
		return String(value);
	}
	expect(typeof value).toBe("string");
	return value;
}

// 64-bit fields are decimal strings; a numeric one would mean the fixture regressed to a lossy encoding.
function exactLong(value) {
	expect(typeof value).toBe("string");
	return value;
}

describe("switchback assigner", () => {
	it("matches every assignSwitchback golden vector", () => {
		const cases = goldenVectors.assignSwitchback;
		expect(cases.length).toEqual(882);

		const armCounts = new Set();
		let boundaryCases = 0;
		for (const c of cases) {
			const periodIndex = exactLong(c.periodIndex);
			const seed = exactLong(c.seed);
			armCounts.add(c.armCount);
			if ([LONG_MIN, LONG_MAX].includes(periodIndex) || [LONG_MIN, LONG_MAX].includes(seed)) ++boundaryCases;

			expect([c, assignSwitchback(clusterUnit(c.clusterUnit), periodIndex, seed, c.armCount)]).toEqual([
				c,
				c.expectedVariant,
			]);
		}
		expect([...armCounts].sort((a, b) => a - b)).toEqual([2, 3, 10]);
		expect(boundaryCases).toBeGreaterThan(0);
	});

	it("matches every fisherYatesPermutation golden vector", () => {
		const cases = goldenVectors.fisherYatesPermutation;
		expect(cases.length).toEqual(504);

		for (const c of cases) {
			const actual = switchbackPermutation(
				clusterUnit(c.clusterUnit),
				exactLong(c.cycleIndex),
				exactLong(c.seed),
				c.armCount
			);
			expect([c, actual]).toEqual([c, c.expectedPermutation]);
		}
	});

	it("covers every arm exactly once per cycle", () => {
		for (const armCount of [2, 3, 10]) {
			for (let cycle = -3; cycle < 20; ++cycle) {
				const seen = new Set();
				for (let slot = 0; slot < armCount; ++slot) {
					seen.add(assignSwitchback("store_42", String(cycle * armCount + slot), "20015998343868", armCount));
				}
				expect(seen.size).toEqual(armCount);
			}
		}
	});

	it("rejects fewer than two arms and non-integral arm counts", () => {
		for (const armCount of [1, 0, -1, 2.5, NaN, "3"]) {
			expect(() => assignSwitchback("u", "0", "0", armCount)).toThrow("armCount must be an integer >= 2");
			expect(() => switchbackPermutation("u", "0", "0", armCount)).toThrow("armCount must be an integer >= 2");
			expect(() => assignSwitchbackPeriod("u", 0, 0, 0, armCount)).toThrow("armCount must be an integer >= 2");
		}
	});

	it("parses signed 64-bit decimal strings exactly and rejects everything else", () => {
		for (const bad of [
			"",
			"-",
			"+",
			"1.0",
			"1e3",
			" 1",
			"0x10",
			"9223372036854775808",
			"-9223372036854775809",
			"١",
		]) {
			expect([bad, parseInt64(bad)]).toEqual([bad, null]);
			expect(() => assignSwitchback("u", bad, "0", 2)).toThrow(
				"periodIndex must be a signed 64-bit decimal string"
			);
			expect(() => assignSwitchback("u", "0", bad, 2)).toThrow("seed must be a signed 64-bit decimal string");
			expect(() => switchbackPermutation("u", bad, "0", 2)).toThrow(
				"cycleIndex must be a signed 64-bit decimal string"
			);
		}
		expect(() => assignSwitchback("u", 5, "0", 2)).toThrow("periodIndex must be a signed 64-bit decimal string");

		// Leading zeros, '+' and "-0" read as Java's Long.parseLong reads them.
		for (const [alias, canonical] of [
			["007", "7"],
			["+7", "7"],
			["-0", "0"],
			["-0009223372036854775808", LONG_MIN],
		]) {
			for (const armCount of [2, 3, 10]) {
				expect(assignSwitchback("market_1", alias, alias, armCount)).toEqual(
					assignSwitchback("market_1", canonical, canonical, armCount)
				);
			}
		}
	});

	// periodIndex = floorDiv(p, arms) and floorMod(p, arms) on the 64-bit value, never a double: a
	// period one below a cycle boundary differs from the boundary only past 2^53.
	it("keeps 64-bit periods and seeds exact past 2^53", () => {
		const max = goldenVectors.assignSwitchback.filter((c) => c.periodIndex === LONG_MAX);
		expect(max.length).toBeGreaterThan(0);
		let differs = 0;
		for (const c of max) {
			// 2^63 - 1 and 2^63 - 2 are the same double.
			differs +=
				assignSwitchback(clusterUnit(c.clusterUnit), "9223372036854775806", c.seed, c.armCount) !==
				c.expectedVariant;
		}
		expect(differs).toBeGreaterThan(0);
	});

	it("draws a context period like the 64-bit function", () => {
		for (const [seedHi, seedLo, seed] of [
			[0, 0, "0"],
			[0, 1, "1"],
			[-1, -1, "-1"],
			[-5, -7, "-17179869191"],
			[0x7fffffff, -1, LONG_MAX],
			[-0x80000000, 0, LONG_MIN],
			[0x1234, 0x5678abcd, "20015998348237"],
		]) {
			for (const period of [0, 1, 2, 9, 10, 23, 99, 2 ** 32 - 1, 2 ** 32, 2 ** 40 + 3, Number.MAX_SAFE_INTEGER]) {
				for (const armCount of [2, 3, 10]) {
					expect(assignSwitchbackPeriod("store-42", period, seedHi, seedLo, armCount)).toEqual(
						assignSwitchback("store-42", String(period), seed, armCount)
					);
				}
			}
		}
	});

	// The key is utf8(clusterUnit + U+001F + cycleIndex), as the platform's String.getBytes(UTF_8),
	// which encodes a lone surrogate as '?'. Values computed with an independent Python reference.
	it("encodes the cluster key as the platform does", () => {
		expect(assignSwitchback("café", "0", "0", 10)).toEqual(assignSwitchback("café", "0", "0", 10));
		expect([
			switchbackPermutation("x\ud800y", "0", "0", 10),
			switchbackPermutation("x?y", "0", "0", 10),
			switchbackPermutation("😀", "0", "0", 10),
		]).toEqual([
			[6, 7, 4, 8, 5, 3, 1, 0, 2, 9],
			[6, 7, 4, 8, 5, 3, 1, 0, 2, 9],
			[5, 6, 1, 3, 0, 8, 4, 9, 2, 7],
		]);
	});
});

describe("switchback attribute paths", () => {
	it("matches every platform path case", () => {
		const cases = pathCases.cases;
		expect(cases.length).toEqual(7);
		for (const c of cases) {
			const path = parseSwitchbackPath(c.path);
			if (!c.supported) {
				expect([c, path]).toEqual([c, null]);
				continue;
			}
			expect(path).not.toBeNull();
			expect([c, resolveSwitchbackPath(path, pathCases.attributes[path.keys[0]])]).toEqual([c, c.value]);
		}
	});

	it("reads quoted segments as literal keys", () => {
		const geo = { 0: "zero", "a/b": "slash" };
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/'0'"), geo)).toEqual("zero");
		expect(resolveSwitchbackPath(parseSwitchbackPath('geo/"a/b"'), geo)).toEqual("slash");
	});

	it("rejects malformed paths", () => {
		for (const path of [
			"geo/'0",
			"'geo",
			'"geo/city',
			'geo/"',
			"geo.city",
			"geo/a.b",
			"a./b",
			".",
			"items/0.5/city",
			"'geo.city'",
			'"geo.city"',
			"geo/'a.b'",
		]) {
			expect([path, parseSwitchbackPath(path)]).toEqual([path, null]);
		}
	});

	it("collapses separators", () => {
		const geo = { city: "Porto" };
		expect(resolveSwitchbackPath(parseSwitchbackPath("/geo//city/"), geo)).toEqual("Porto");
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo"), geo)).toEqual(geo);
		expect(parseSwitchbackPath("/geo//city/")).toEqual({ keys: ["geo", "city"], indices: [null, null] });
	});

	it("rejects unsupported paths", () => {
		for (const path of [
			null,
			undefined,
			7,
			{},
			"",
			"/",
			"//",
			"0/city",
			"items/0",
			"items/0/1/city",
			"items/-1/city",
			"'",
		]) {
			expect([path, parseSwitchbackPath(path)]).toEqual([path, null]);
		}
	});

	it("reads arrays only through index segments and objects only through key segments", () => {
		const items = [{ city: "Lisbon" }];
		const geo = { 0: { city: "zero" } };
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/0/city"), geo)).toBeNull();
		expect(resolveSwitchbackPath(parseSwitchbackPath("items/1/city"), items)).toBeNull();
		expect(resolveSwitchbackPath(parseSwitchbackPath("name/x"), "scalar")).toBeNull();
		expect(resolveSwitchbackPath(parseSwitchbackPath("items/city"), items)).toBeNull();
		expect(resolveSwitchbackPath(parseSwitchbackPath("items/-0/city"), items)).toEqual("Lisbon");
		// Only own keys: an inherited property is not a value.
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/constructor"), {})).toBeNull();
		expect(resolveSwitchbackPath(parseSwitchbackPath("items/length"), items)).toBeNull();
	});

	// The Collector reads the attribute as published, through its JSON encoding.
	it("reads values through their JSON encoding", () => {
		const cyclic = { city: "Porto" };
		cyclic.self = cyclic;
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/city"), cyclic)).toBeNull();
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/city"), { city: 10n })).toBeNull();
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/when"), { when: new Date(0) })).toEqual(
			"1970-01-01T00:00:00.000Z"
		);
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/city"), { city: undefined })).toBeNull();
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/city"), { toJSON: () => ({ city: "Faro" }) })).toEqual(
			"Faro"
		);
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/0/x"), [{ x: undefined }])).toBeNull();
		// A value reached twice through siblings is not a cycle.
		const shared = { a: "b" };
		expect(resolveSwitchbackPath(parseSwitchbackPath("geo/city"), { city: "Porto", x: shared, y: shared })).toEqual(
			"Porto"
		);
	});

	it("parses index segments as Guava Ints.tryParse", () => {
		expect(tryParseInt("0")).toEqual(0);
		expect(Object.is(tryParseInt("-0"), 0)).toBe(true);
		expect(tryParseInt("007")).toEqual(7);
		expect(tryParseInt("2147483647")).toEqual(2147483647);
		expect(tryParseInt("-2147483648")).toEqual(-2147483648);
		expect(tryParseInt("00000000002147483647")).toEqual(2147483647);
		for (const s of ["", "-", "+1", "1a", " 1", "2147483648", "-2147483649", "99999999999999999999", "٠", "1.0"]) {
			expect([s, tryParseInt(s)]).toEqual([s, null]);
		}
	});
});

describe("switchback cluster values", () => {
	it("keys non-empty strings as-is and whole numbers by their decimal text", () => {
		expect(switchbackClusterKey("s-1")).toEqual("s-1");
		expect(switchbackClusterKey(" ")).toEqual(" ");
		expect(switchbackClusterKey(17)).toEqual("17");
		expect(switchbackClusterKey(-17)).toEqual("-17");
		expect(switchbackClusterKey(0)).toEqual("0");
		expect(switchbackClusterKey(-0)).toEqual("0");
		expect(switchbackClusterKey(4000000002)).toEqual("4000000002");
		expect(switchbackClusterKey(2 ** 53 + 2)).toEqual("9007199254740994");
		expect(switchbackClusterKey(1e20)).toEqual("100000000000000000000");
		// JS cannot tell 3.0 from 3: both are the integer 3 (documented limitation).
		expect(switchbackClusterKey(3.0)).toEqual("3");
	});

	it("gives no key for anything else", () => {
		for (const value of [
			1.5,
			-0.5,
			1e21,
			-1e21,
			NaN,
			Infinity,
			-Infinity,
			true,
			false,
			{},
			{ a: 1 },
			["a"],
			[],
			"",
			null,
			undefined,
			10n,
		]) {
			expect([value, switchbackClusterKey(value)]).toEqual([value, null]);
		}
	});
});

describe("switchback serving", () => {
	const paths = (...p) => p.map((x) => parseSwitchbackPath(x));
	const reader = (attrs) => (path) => resolveSwitchbackPath(path, attrs[path.keys[0]]);

	// The declared source order decides, not the order of the units.
	it("serves under the first declared source whatever the unit order", () => {
		const units = { user_id: "u1", session_id: "x1" };
		const attrs = { session_store: "s-1", user_store: "s-1" };
		expect(
			resolveSwitchbackServing(
				["session_id", "user_id"],
				paths("session_store", "user_store"),
				null,
				units,
				reader(attrs)
			)
		).toEqual({ status: SWITCHBACK_ELIGIBLE, unitType: "session_id", clusterKey: "s-1" });
		expect(
			resolveSwitchbackServing(
				["user_id", "session_id"],
				paths("user_store", "session_store"),
				null,
				units,
				reader(attrs)
			)
		).toEqual({ status: SWITCHBACK_ELIGIBLE, unitType: "user_id", clusterKey: "s-1" });
	});

	it("is absent without a linked unit and ineligible without a value, on disagreement or outside the allow-list", () => {
		const types = ["session_id", "user_id"];
		const p = paths("session_store", "user_store");
		expect(resolveSwitchbackServing(types, p, null, { device_id: "d" }, reader({ session_store: "a" }))).toEqual({
			status: SWITCHBACK_ABSENT,
			unitType: null,
			clusterKey: null,
		});
		const both = { session_id: "x", user_id: "u" };
		expect(resolveSwitchbackServing(types, p, null, both, reader({}))).toEqual({
			status: SWITCHBACK_INELIGIBLE,
			unitType: "session_id",
			clusterKey: null,
		});
		expect(
			resolveSwitchbackServing(types, p, null, both, reader({ session_store: "a", user_store: "b" })).status
		).toEqual(SWITCHBACK_INELIGIBLE);
		expect(resolveSwitchbackServing(types, p, ["b"], both, reader({ session_store: "a" })).status).toEqual(
			SWITCHBACK_INELIGIBLE
		);
		expect(resolveSwitchbackServing(types, p, ["a"], both, reader({ session_store: "a" })).status).toEqual(
			SWITCHBACK_ELIGIBLE
		);
		expect(resolveSwitchbackServing(types, p, [], both, reader({ session_store: "a" })).status).toEqual(
			SWITCHBACK_ELIGIBLE
		);
		// Entries compare as text: a numeric entry admits its decimal key.
		expect(resolveSwitchbackServing(types, p, [17], both, reader({ session_store: "17" })).status).toEqual(
			SWITCHBACK_ELIGIBLE
		);
		expect(resolveSwitchbackServing(types, p, [null], both, reader({ session_store: "null" })).status).toEqual(
			SWITCHBACK_INELIGIBLE
		);
		// A malformed allow-list admits nothing rather than everything.
		expect(resolveSwitchbackServing(types, p, "a", both, reader({ session_store: "a" })).status).toEqual(
			SWITCHBACK_INELIGIBLE
		);
		// A unit without a value is skipped: the next one serves.
		expect(resolveSwitchbackServing(types, p, null, both, reader({ user_store: "b" }))).toEqual({
			status: SWITCHBACK_ELIGIBLE,
			unitType: "user_id",
			clusterKey: "b",
		});
		// The number 17 and the string "17" agree.
		expect(
			resolveSwitchbackServing(types, p, null, both, reader({ session_store: 17, user_store: "17" })).status
		).toEqual(SWITCHBACK_ELIGIBLE);
	});

	it("reads the cluster sources in declared order and rejects unreadable maps", () => {
		expect(switchbackSources({ user_id: "a", device_id: "b/c", store_id: "'d'" })).toEqual({
			types: ["user_id", "device_id", "store_id"],
			paths: paths("a", "b/c", "'d'"),
		});
		for (const clusters of [
			null,
			undefined,
			{},
			[],
			"x",
			3,
			{ a: "'x" },
			{ a: "x.y" },
			{ a: 7 },
			{ a: null },
			{ a: "x", 2: "y" },
		]) {
			expect([clusters, switchbackSources(clusters)]).toEqual([clusters, null]);
		}
		// A lone array-index unit type has no order to lose.
		expect(switchbackSources({ 7: "x" })).toEqual({ types: ["7"], paths: paths("x") });
		expect(switchbackSources({ "07": "x", a: "y" })).toEqual({ types: ["07", "a"], paths: paths("x", "y") });
	});
});

describe("switchback schedule", () => {
	const HOUR = 3600000;
	const ANCHOR = 1767225600000;
	const schedule = (startAt, periodMs, arms = 2) => ({
		switchbackStartAt: startAt,
		switchbackPeriodMs: periodMs,
		split: new Array(arms).fill(1 / arms),
	});

	it("indexes periods from the anchor and is null before it", () => {
		expect(switchbackPeriodIndex(schedule(ANCHOR, HOUR), ANCHOR - 1)).toBeNull();
		expect(switchbackPeriodIndex(schedule(ANCHOR, HOUR), ANCHOR)).toEqual(0);
		expect(switchbackPeriodIndex(schedule(ANCHOR, HOUR), ANCHOR + HOUR - 1)).toEqual(0);
		expect(switchbackPeriodIndex(schedule(ANCHOR, HOUR), ANCHOR + HOUR)).toEqual(1);
		expect(switchbackPeriodIndex(schedule(0, HOUR), 0)).toEqual(0);
		expect(switchbackPeriodIndex(schedule(0, 1), Number.MAX_SAFE_INTEGER)).toEqual(Number.MAX_SAFE_INTEGER);
		expect(switchbackPeriodIndex(schedule(0, 3), 2 ** 53 - 2)).toEqual(Math.floor((2 ** 53 - 2) / 3));
		// 1440000000000 ms (400,000 h), the cross-SDK grid.
		expect(
			switchbackPeriodIndex(schedule(1704067200000, 1440000000000), 1704067200000 + 1440000000000 - 1)
		).toEqual(0);
		// The double quotient's floor is the exact floor for every integer below 2^53.
		for (let periodMs = 7; periodMs < 2 ** 40; periodMs = periodMs * 3 + 1) {
			for (const elapsed of [periodMs * 1000 - 1, 2 ** 53 - 1 - ((2 ** 53 - 1) % periodMs) - 1]) {
				const index = switchbackPeriodIndex(schedule(0, periodMs), elapsed);
				expect(index * periodMs <= elapsed && elapsed < (index + 1) * periodMs).toBe(true);
			}
		}
	});

	it("is unservable for a bad anchor, period or arm count", () => {
		const maxAnchor = 253402300800000;
		for (const startAt of [
			ANCHOR + 1,
			ANCHOR - 1,
			ANCHOR + 30 * 60000,
			-HOUR,
			-1,
			maxAnchor,
			maxAnchor + HOUR,
			1.5,
			NaN,
			Infinity,
			null,
			undefined,
			"0",
			String(ANCHOR),
		]) {
			expect([startAt, switchbackPeriodIndex(schedule(startAt, HOUR), ANCHOR + 10 * HOUR)]).toEqual([
				startAt,
				null,
			]);
		}
		for (const periodMs of [0, -HOUR, 0.5, NaN, Infinity, null, undefined, "3600000"]) {
			expect([periodMs, switchbackPeriodIndex(schedule(ANCHOR, periodMs), ANCHOR + 10 * HOUR)]).toEqual([
				periodMs,
				null,
			]);
		}
		expect(switchbackPeriodIndex(schedule(ANCHOR, HOUR, 1), ANCHOR)).toBeNull();
		expect(switchbackPeriodIndex({ switchbackStartAt: ANCHOR, switchbackPeriodMs: HOUR }, ANCHOR)).toBeNull();
		expect(switchbackPeriodIndex(schedule(maxAnchor - HOUR, HOUR), maxAnchor)).toEqual(1);
	});

	it("keeps the epoch only for the same switchback identity", () => {
		const base = {
			id: 1,
			iteration: 1,
			unitType: "store_id",
			split: [0.5, 0.5],
			seedHi: 1,
			switchbackClusters: { store_id: "a", user_id: "b" },
			switchbackClusterValues: ["x"],
			switchbackStartAt: ANCHOR,
			switchbackPeriodMs: HOUR,
			switchbackDesignType: "balanced_block",
			switchbackEstimand: "e",
			switchbackBurnInDurationMs: 0,
		};
		const same = (changes, readable = true) =>
			sameSwitchbackIdentity(base, readable, { ...base, ...changes }, readable);
		expect(same({})).toBe(true);
		expect(
			same({
				seedHi: 2,
				split: [0.1, 0.9],
				switchbackEstimand: "f",
				switchbackBurnInDurationMs: 5,
				unitType: "x",
			})
		).toBe(true);
		expect(same({ switchbackClusters: { store_id: "a", user_id: "b" }, switchbackClusterValues: ["x"] })).toBe(
			true
		);
		expect(same({ switchbackClusterValues: undefined }, true)).toBe(false);
		for (const changes of [
			{ id: 2 },
			{ iteration: 2 },
			{ switchbackClusters: { user_id: "b", store_id: "a" } },
			{ switchbackClusters: { store_id: "a", user_id: "c" } },
			{ switchbackClusters: { store_id: "a" } },
			{ switchbackClusterValues: ["y"] },
			{ switchbackClusterValues: null },
			{ switchbackStartAt: ANCHOR + HOUR },
			{ switchbackPeriodMs: 2 * HOUR },
			{ switchbackDesignType: "other" },
		]) {
			expect([changes, same(changes)]).toEqual([changes, false]);
		}
		// On the legacy path the declared unitType is identity.
		expect(same({ unitType: "x" }, false)).toBe(false);
		expect(sameSwitchbackIdentity(base, true, { ...base, unitType: "x" }, false)).toBe(false);
		expect(same({ switchbackClusterValues: null }, false)).toBe(false);
		expect(
			sameSwitchbackIdentity(
				{ ...base, switchbackClusterValues: null },
				true,
				{ ...base, switchbackClusterValues: undefined },
				true
			)
		).toBe(true);
	});
});

describe("switchback hashing context", () => {
	it("never hashes the cluster key", () => {
		// The draw over the raw key differs from a draw over its unit hash.
		let differs = 0;
		for (let period = 0; period < 12; ++period) {
			differs +=
				assignSwitchbackPeriod("store-42", period, -5, -7, 3) !==
				assignSwitchbackPeriod(hashUnit("store-42"), period, -5, -7, 3);
		}
		expect(differs).toBeGreaterThan(0);
	});
});
