import Client from "../client";
import SDK from "../sdk";
import Context from "../context";
import { hashUnit } from "../utils";
import { VariantAssigner } from "../assigner";
import { assignSwitchbackPeriod } from "../switchback";
import { ContextPublisher } from "../publisher";
import { ContextDataProvider } from "../provider";
import pathCases from "./fixtures/switchback/attribute-path-cases.json";

jest.mock("../client");
jest.mock("../sdk");
jest.mock("../provider");
jest.mock("../publisher");

// Port of java-sdk's SwitchbackServerParityTest: replays the Collector's R33 serving rules
// (ContextAPI.switchbackServing and switchbackVariant) through the public Context API. Each case states,
// independently of SDK code, the serving unit type and the raw cluster key the Collector picks, or that
// it records nothing; the expected variant comes from REFERENCE_SCHEDULES.
const HOUR = 3600000;
const ANCHOR = 1767225600000;
const PERIODS = 4;
const ARMS = 3;
// SEED = 1234567890123 = (287 << 32) | 1912276171.
const SEED_HI = 287;
const SEED_LO = 1912276171;

const STORE = "store_id";
const DEVICE = "device_id";
const USER = "user_id";
const TWO_SOURCES = { [STORE]: "store_city", [DEVICE]: "geo/city" };

const sdk = new SDK();
const client = new Client();
const publisher = new ContextPublisher();
sdk.getContextDataProvider.mockReturnValue(new ContextDataProvider());
sdk.getContextPublisher.mockReturnValue(publisher);
sdk.getClient.mockReturnValue(client);
client.getApplication.mockReturnValue({ name: "website", version: 0 });
client.getEnvironment.mockReturnValue("production");

let clock;

beforeEach(() => {
	clock = ANCHOR;
	jest.spyOn(Date, "now").mockImplementation(() => clock);
});

function experiment(clusters, values = null, overrides = {}) {
	const split = [];
	const variants = [];
	for (let i = 0; i < ARMS; ++i) {
		split.push(1 / ARMS);
		variants.push({ name: String(i), config: null });
	}
	return {
		id: 1,
		name: "exp_sb",
		// R33 payloads may still carry unitType; it is never used for switchback assignment.
		unitType: USER,
		iteration: 1,
		seedHi: SEED_HI,
		seedLo: SEED_LO,
		split,
		trafficSeedHi: 0,
		trafficSeedLo: 0,
		trafficSplit: [0, 1],
		fullOnVariant: 0,
		applications: [{ name: "website" }],
		variants,
		audience: null,
		audienceStrict: false,
		customFieldValues: null,
		randomizationType: "switchback",
		switchbackClusters: clusters,
		switchbackClusterValues: values,
		switchbackStartAt: ANCHOR,
		switchbackPeriodMs: HOUR,
		switchbackDesignType: "balanced_block",
		...overrides,
	};
}

function createContext(experiments, units) {
	const exposures = [];
	const eventLogger = (_, eventName, data) => {
		if (eventName === "exposure") exposures.push(data);
	};
	const context = new Context(sdk, { publishDelay: -1, refreshPeriod: 0, eventLogger }, { units }, { experiments });
	return { context, exposures };
}

// Serves PERIODS periods with treatment, one call per period.
function serve(exp, units, attributes) {
	// The attributes are set at context creation, before every period, as in Java.
	clock = ANCHOR;
	const { context, exposures } = createContext([exp], units);
	if (attributes != null) context.attributes(attributes);
	const variants = [];
	for (let p = 0; p < PERIODS; ++p) {
		clock = ANCHOR + p * HOUR + 1;
		variants.push(context.treatment("exp_sb"));
	}
	return { variants, exposures };
}

// Periods 0..3 of each raw key under SEED with 3 arms, from an independent Python murmur3 reference that
// reproduces every platform golden vector; never computed by the SDK.
const REFERENCE_SCHEDULES = {
	Lisboa: [0, 1, 2, 2],
	Porto: [2, 1, 0, 1],
	42: [0, 2, 1, 2],
	Faro: [0, 1, 2, 1],
	"-7": [2, 0, 1, 0],
	Lisbon: [2, 0, 1, 1],
	"plus-one-key": [2, 1, 0, 0],
};

function collectorVariant(key, period) {
	expect(Object.prototype.hasOwnProperty.call(REFERENCE_SCHEDULES, key)).toBe(true);
	return REFERENCE_SCHEDULES[key][period];
}

// The Collector served `key` under a unit of `servingType`: one eligible exposure per period under that
// unit, variant from the raw key.
function expectEligible(served, servingType, key, message) {
	expect([message, served.exposures.length]).toEqual([message, PERIODS]);
	for (let p = 0; p < PERIODS; ++p) {
		const expected = collectorVariant(key, p);
		const e = served.exposures[p];
		expect([message, p, served.variants[p], e.unit, e.variant, e.assigned, e.eligible, e.exposedAt]).toEqual([
			message,
			p,
			expected,
			servingType,
			expected,
			true,
			true,
			ANCHOR + p * HOUR + 1,
		]);
	}
}

// The Collector records nothing: control in every period, no exposure.
function expectSilentControl(served, message) {
	expect([message, served.variants]).toEqual([message, [0, 0, 0, 0]]);
	expect([message, served.exposures]).toEqual([message, []]);
}

const twoUnits = () => ({ [STORE]: "s1", [DEVICE]: "d1" });

describe("switchback server parity", () => {
	// Independent murmur3 reference: periods 0..3 of the raw keys under SEED with 3 arms.
	it("matches the independent reference for raw-key schedules", () => {
		expectEligible(
			serve(experiment({ [STORE]: "city" }), { [STORE]: "s1" }, { city: "Lisboa" }),
			STORE,
			"Lisboa",
			"Lisboa"
		);
		// The SDK's own period draw agrees with the reference for every key the suite uses.
		for (const key of Object.keys(REFERENCE_SCHEDULES)) {
			for (let p = 0; p < PERIODS; ++p) {
				expect([key, p, assignSwitchbackPeriod(key, p, SEED_HI, SEED_LO, ARMS)]).toEqual([
					key,
					p,
					collectorVariant(key, p),
				]);
			}
		}
	});

	it("serves agreement under the first source unit", () => {
		expectEligible(
			serve(experiment(TWO_SOURCES), twoUnits(), { store_city: "Lisboa", geo: { city: "Lisboa" } }),
			STORE,
			"Lisboa",
			"agreement"
		);
	});

	it("records nothing for a disagreement", () => {
		expectSilentControl(
			serve(experiment(TWO_SOURCES), twoUnits(), { store_city: "Lisboa", geo: { city: "Porto" } }),
			"disagreement"
		);
	});

	// A unit yielding no value is skipped; the next unit with a value serves.
	it("skips a missing value and serves the next value", () => {
		expectEligible(
			serve(experiment(TWO_SOURCES), twoUnits(), { geo: { city: "Porto" } }),
			DEVICE,
			"Porto",
			"first missing"
		);
		expectEligible(
			serve(experiment(TWO_SOURCES), twoUnits(), { store_city: "Porto" }),
			STORE,
			"Porto",
			"second missing"
		);
		expectSilentControl(serve(experiment(TWO_SOURCES), twoUnits(), { other: "x" }), "no value at all");
		expectSilentControl(serve(experiment(TWO_SOURCES), twoUnits(), null), "no attributes");
	});

	// A unit linked by a source but absent from the context does not take part.
	it("lets only linked units present in the context take part", () => {
		expectEligible(
			serve(experiment(TWO_SOURCES), { [DEVICE]: "d1" }, { store_city: "Lisboa", geo: { city: "Porto" } }),
			DEVICE,
			"Porto",
			"store unit absent"
		);
	});

	it("records nothing for a filtered value and serves an allowed value", () => {
		const lisboa = { store_city: "Lisboa" };
		expectSilentControl(serve(experiment(TWO_SOURCES, ["Porto", "Faro"]), twoUnits(), lisboa), "filtered");
		expectEligible(
			serve(experiment(TWO_SOURCES, ["Porto", "Lisboa"]), twoUnits(), lisboa),
			STORE,
			"Lisboa",
			"allowed"
		);
		// A null or empty allow-list admits every value.
		expectEligible(serve(experiment(TWO_SOURCES, null), twoUnits(), lisboa), STORE, "Lisboa", "null filter");
		expectEligible(serve(experiment(TWO_SOURCES, []), twoUnits(), lisboa), STORE, "Lisboa", "empty filter");
		// The filter compares the normalised text of numeric values.
		expectEligible(
			serve(experiment(TWO_SOURCES, ["42"]), twoUnits(), { store_city: 42 }),
			STORE,
			"42",
			"numeric filter"
		);
		// A filtered first value is not replaced by a later allowed one: they disagree.
		expectSilentControl(
			serve(experiment(TWO_SOURCES, ["Porto"]), twoUnits(), { store_city: "Lisboa", geo: { city: "Porto" } }),
			"filtered first value"
		);
	});

	// An ineligible cluster is listed under the first linked unit present, not the unit that gave the
	// rejected value: an override shows that unit.
	it("records an override on an ineligible cluster under the first linked unit", () => {
		clock = ANCHOR;
		const { context, exposures } = createContext([experiment(TWO_SOURCES, ["Lisboa"])], twoUnits());
		context.attribute("geo", { city: "Porto" });
		context.override("exp_sb", 2);
		clock = ANCHOR + 1;
		expect(context.treatment("exp_sb")).toEqual(2);
		expect(exposures.map((e) => [e.unit, e.variant, e.overridden])).toEqual([[STORE, 2, true]]);
	});

	it("rejects a second uid of the same type", () => {
		const { context } = createContext([], { [STORE]: "s1" });
		expect(() => context.unit(STORE, "s2")).toThrow("Unit 'store_id' UID already set.");
		expectEligible(
			serve(experiment({ [STORE]: "city" }), { [STORE]: "s1" }, { city: "Faro" }),
			STORE,
			"Faro",
			"single unit"
		);
	});

	// The declared order decides, not the order units were set or named.
	it("serves the lower unit type id source first", () => {
		const agreeing = { store_city: "Lisboa", geo: { city: "Lisboa" } };
		const units = { [STORE]: "s1", [DEVICE]: "d1" };
		expectEligible(
			serve(experiment({ [DEVICE]: "geo/city", [STORE]: "store_city" }), units, agreeing),
			DEVICE,
			"Lisboa",
			"device declared first"
		);
		expectEligible(serve(experiment(TWO_SOURCES), units, agreeing), STORE, "Lisboa", "store declared first");
	});

	// Booleans, fractions, objects, arrays, null and "" yield no value: skipped, never a disagreement.
	// (JS cannot tell 2.0 from 2, so 2.0 is keyed like the integer and is not in this list.)
	it("ignores values that give no key", () => {
		for (const value of [true, false, 1.5, { a: "b" }, ["x"], [], null, ""]) {
			const message = `ignored ${JSON.stringify(value)}`;
			expectEligible(
				serve(experiment(TWO_SOURCES), twoUnits(), { store_city: value, geo: { city: "Porto" } }),
				DEVICE,
				"Porto",
				message
			);
			expectSilentControl(
				serve(experiment({ [STORE]: "store_city" }), { [STORE]: "s1" }, { store_city: value }),
				`${message} alone`
			);
		}
	});

	// Integral numbers are keyed by their base-10 text, so they agree with that text.
	it("keys numeric values as text", () => {
		for (const store of [42, "42"]) {
			for (const device of [42, "42"]) {
				expectEligible(
					serve(experiment(TWO_SOURCES), twoUnits(), { store_city: store, geo: { city: device } }),
					STORE,
					"42",
					`${typeof store}/${typeof device}`
				);
			}
		}
		expectEligible(serve(experiment({ [STORE]: "n" }), { [STORE]: "s1" }, { n: -7 }), STORE, "-7", "negative");
		expectSilentControl(
			serve(experiment(TWO_SOURCES), twoUnits(), { store_city: 42, geo: { city: "042" } }),
			"42 vs 042 disagree"
		);
	});

	// A malformed path makes the whole experiment unservable: ineligible control for any linked unit, even
	// when another source is valid.
	it("records nothing for malformed paths", () => {
		const attributes = { store_city: "Lisboa", geo: { city: "Porto" }, "geo.city": "Faro" };
		for (const path of ["'geo/city", '"geo', "geo/'city", "geo.city", "geo/a.b", "'geo.city'", '"geo.city"']) {
			expectSilentControl(
				serve(experiment({ [STORE]: "store_city", [DEVICE]: path }), twoUnits(), attributes),
				path
			);
			expectSilentControl(serve(experiment({ [DEVICE]: path }), twoUnits(), attributes), `${path} alone`);
		}
	});

	// No context unit of any linked type: the experiment does not apply; unitType is never used.
	it("does not apply without a linked unit", () => {
		expectSilentControl(
			serve(experiment(TWO_SOURCES), { [USER]: "u1" }, { store_city: "Lisboa" }),
			"no linked unit"
		);
	});

	// Traffic eligibility is sticky on the serving unit's hash: it equals that of a unit experiment on the
	// serving unit's type with the same traffic seed and split, in every period.
	it("follows the serving unit's hash for traffic", () => {
		let eligible = 0;
		let ineligible = 0;
		for (let u = 0; u < 24; ++u) {
			const traffic = { trafficSplit: [0.5, 0.5], trafficSeedHi: 3, trafficSeedLo: 4 };
			const switchback = experiment(TWO_SOURCES, null, traffic);
			const twin = { ...experiment(TWO_SOURCES, null, traffic), id: 2, name: "exp_unit", unitType: DEVICE };
			delete twin.randomizationType;
			clock = ANCHOR;
			const { context, exposures } = createContext([switchback, twin], {
				[STORE]: "s1",
				[DEVICE]: `device-${u}`,
			});
			// Only the device unit has a value, so it serves.
			context.attribute("geo", { city: "Porto" });
			context.treatment("exp_unit");
			const twinEligible = exposures[0].eligible;
			expect(twinEligible).toEqual(new VariantAssigner(hashUnit(`device-${u}`)).assign([0.5, 0.5], 3, 4) === 1);
			for (let p = 0; p < PERIODS; ++p) {
				clock = ANCHOR + p * HOUR;
				const variant = context.treatment("exp_sb");
				expect([exposures[p + 1].unit, exposures[p + 1].eligible]).toEqual([DEVICE, twinEligible]);
				expect(variant).toEqual(twinEligible ? collectorVariant("Porto", p) : 0);
			}
			if (twinEligible) ++eligible;
			else ++ineligible;
		}
		expect(eligible).toBeGreaterThan(0);
		expect(ineligible).toBeGreaterThan(0);
	});

	// Each attribute-path-cases.json case, served as a cluster path over the fixture's attributes:
	// unsupported paths are unservable, a null value is ineligible, and any other value serves.
	it("matches the Collector on every attribute path case", () => {
		let eligibleCases = 0;
		for (const c of pathCases.cases) {
			const served = serve(experiment({ [STORE]: c.path }), { [STORE]: "s1" }, pathCases.attributes);
			if (!c.supported || c.value == null) {
				expectSilentControl(served, c.path);
				continue;
			}
			expectEligible(served, STORE, c.value, c.path);
			++eligibleCases;
		}
		expect(eligibleCases).toEqual(3);
	});

	// The latest supplied value of a repeated attribute name serves; names are matched trimmed.
	it("resolves repeated attribute names to the latest", () => {
		expectEligible(
			serve(experiment({ [STORE]: "cluster" }), { [STORE]: "s1" }, { " cluster ": "Porto" }),
			STORE,
			"Porto",
			"trimmed"
		);
		clock = ANCHOR;
		const { context, exposures } = createContext([experiment({ [STORE]: "cluster" })], { [STORE]: "s1" });
		context.attribute("cluster", "Lisboa");
		context.attribute("cluster", "Porto");
		clock = ANCHOR + 1;
		expect(context.treatment("exp_sb")).toEqual(collectorVariant("Porto", 0));
		expect(exposures[0].eligible).toBe(true);
	});
});
