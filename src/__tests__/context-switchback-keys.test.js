import Client from "../client";
import SDK from "../sdk";
import Context from "../context";
import { hashUnit } from "../utils";
import { VariantAssigner } from "../assigner";
import { assignSwitchbackPeriod } from "../switchback";
import { ContextPublisher } from "../publisher";
import { ContextDataProvider } from "../provider";

jest.mock("../client");
jest.mock("../sdk");
jest.mock("../provider");
jest.mock("../publisher");

// Port of java-sdk's ContextSwitchbackClusterTest: cluster key selection inside Context. Variants are
// derived from the raw key and the assigner, both pinned by the platform golden vectors.
const UNIT_TYPE = "store_id";
const UID = "e791e240fcd3df7d238cfc285f475e8152fcc0ec";
const HOUR = 3600000;
const ANCHOR = 1767225600000;
const SEED_HI = -5;
const SEED_LO = -7;
// 3 arms over 12 periods: two keys in different buckets are told apart by their schedules.
const ARMS = 3;
const GOLD_AUDIENCE = '{"filter":[{"eq":[{"var":"tier"},{"value":"gold"}]}]}';

const sdk = new SDK();
const client = new Client();
const publisher = new ContextPublisher();
const provider = new ContextDataProvider();

sdk.getContextDataProvider.mockReturnValue(provider);
sdk.getContextPublisher.mockReturnValue(publisher);
sdk.getClient.mockReturnValue(client);
client.getApplication.mockReturnValue({ name: "website", version: 0 });
client.getEnvironment.mockReturnValue("production");

let clock;

beforeEach(() => {
	clock = ANCHOR;
	jest.spyOn(Date, "now").mockImplementation(() => clock);
	publisher.publish.mockReset();
	publisher.publish.mockReturnValue(Promise.resolve());
	provider.getContextData.mockReset();
});

function attributeSwitchback(path) {
	const split = [];
	const variants = [];
	for (let i = 0; i < ARMS; ++i) {
		split.push(1 / ARMS);
		variants.push({ name: String.fromCharCode(65 + i), config: `{"sb.arm":${i}}` });
	}
	return {
		id: 1,
		name: "exp_sb",
		unitType: UNIT_TYPE,
		iteration: 1,
		seedHi: SEED_HI,
		seedLo: SEED_LO,
		split,
		trafficSeedHi: 1,
		trafficSeedLo: 2,
		trafficSplit: [0, 1],
		fullOnVariant: 0,
		applications: [{ name: "website" }],
		variants,
		audience: null,
		audienceStrict: false,
		customFieldValues: null,
		randomizationType: "switchback",
		switchbackClusters: { [UNIT_TYPE]: path },
		switchbackStartAt: ANCHOR,
		switchbackPeriodMs: HOUR,
		switchbackCarryoverDurationMs: 0,
		switchbackBurnInDurationMs: 0,
		switchbackBurnOutDurationMs: 0,
		switchbackDesignType: "balanced_block",
		switchbackEstimand: "global_average_treatment_effect",
	};
}

const dataOf = (...experiments) => ({ experiments });

function createContext(data, units = { [UNIT_TYPE]: UID }) {
	return new Context(sdk, { publishDelay: -1, refreshPeriod: 0 }, { units }, data);
}

async function refreshTo(context, experiment) {
	provider.getContextData.mockReturnValue(Promise.resolve(dataOf(experiment)));
	await context.refresh();
}

async function publishEvent(context) {
	publisher.publish.mockClear();
	await context.publish();
	expect(publisher.publish).toHaveBeenCalledTimes(1);
	return publisher.publish.mock.calls[0][0];
}

async function publishExposures(context) {
	return (await publishEvent(context)).exposures;
}

// The Collector's draw: the raw cluster key, unhashed.
const expected = (key, periodIndex) => assignSwitchbackPeriod(key, periodIndex, SEED_HI, SEED_LO, ARMS);
const expectedSchedule = (key) => [...Array(12).keys()].map((i) => expected(key, i));

function peekSchedule(context) {
	const result = [];
	for (let i = 0; i < 12; ++i) {
		clock = ANCHOR + i * HOUR;
		result.push(context.peek("exp_sb"));
	}
	return result;
}

function exposure(variant, exposedAt, eligible, audienceMismatch, flags = {}) {
	return {
		id: 1,
		name: "exp_sb",
		unit: UNIT_TYPE,
		exposedAt,
		variant,
		assigned: true,
		eligible,
		overridden: false,
		fullOn: false,
		custom: false,
		audienceMismatch,
		ruleOverride: false,
		...flags,
	};
}

async function exposeAndPublish(context) {
	clock = ANCHOR;
	context.treatment("exp_sb");
	return publishEvent(context);
}

describe("switchback cluster keys in Context", () => {
	// The unit uid is never the cluster key: with no cluster value the unit is ineligible.
	it("never keys the cluster by the unit uid", () => {
		const context = createContext(dataOf(attributeSwitchback("city")));
		for (let i = 0; i < 3; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.treatment("exp_sb")).toEqual(0);
		}
		expect(context.pending()).toEqual(0);
	});

	// A numeric uid serves and publishes under its canonical string (toFixed(0)), exactly as the same
	// string uid does; the cluster key is the attribute.
	it("clusters a numeric unit uid like its canonical string", async () => {
		for (const [numeric, text] of [
			[123456789, "123456789"],
			[123456789.0, "123456789"],
			[2 ** 53 + 1, "9007199254740992"],
			[125.75, "126"],
		]) {
			const numericContext = createContext(dataOf(attributeSwitchback("city")), { [UNIT_TYPE]: numeric });
			clock = ANCHOR;
			numericContext.attribute("city", "Lisboa");
			const numericEvent = await exposeAndPublish(numericContext);
			const numericSchedule = peekSchedule(numericContext);
			const textContext = createContext(dataOf(attributeSwitchback("city")), { [UNIT_TYPE]: text });
			clock = ANCHOR;
			textContext.attribute("city", "Lisboa");
			const textEvent = await exposeAndPublish(textContext);

			expect(numericSchedule).toEqual(expectedSchedule("Lisboa"));
			expect(numericSchedule).toEqual(peekSchedule(textContext));
			expect(numericEvent.units).toEqual(textEvent.units);
			expect(numericEvent.exposures).toEqual(textEvent.exposures);
			expect(numericEvent.units[0].uid).toEqual(hashUnit(text));
		}
	});

	// Independent reference (Python MD5/base64url) for the published hash of numeric uids (2 ** 53 + 1
	// is 2 ** 53 as a double, as in Java), and the
	// raw-key schedule of 123456789 as a numeric attribute value (murmur3 reference).
	it("matches the independent reference for numeric uids and values", async () => {
		const schedule = [0, 2, 1, 0, 1, 2, 0, 1, 2, 2, 1, 0];
		for (const [uid, hash] of [
			[123456789, "JfnnlDI7RTiF9RgfG2JNCw"],
			[2 ** 53 + 1, "OngwCmjeKhIQyeNybDy4eg"],
		]) {
			const context = createContext(dataOf(attributeSwitchback("region")), { [UNIT_TYPE]: uid });
			clock = ANCHOR;
			context.attribute("region", 123456789);
			const published = await exposeAndPublish(context);

			expect(published.units[0].uid).toEqual(hash);
			expect(published.exposures).toEqual([exposure(schedule[0], ANCHOR, true, false)]);
			expect(peekSchedule(context)).toEqual(schedule);
		}
	});

	// Periods 0..11 of the raw key "Lisboa", from the independent murmur3 reference.
	it("serves the raw attribute value", () => {
		const context = createContext(dataOf(attributeSwitchback("city")));
		context.attribute("city", "Lisboa");
		expect(peekSchedule(context)).toEqual([0, 2, 1, 2, 1, 0, 1, 0, 2, 0, 1, 2]);
		expect(peekSchedule(context)).toEqual(expectedSchedule("Lisboa"));
	});

	it("gives units sharing an attribute value the same schedule", () => {
		const lisboa = createContext(dataOf(attributeSwitchback("city")));
		lisboa.attribute("city", "Lisboa");
		const porto = createContext(dataOf(attributeSwitchback("city")));
		porto.attribute("city", "Porto");
		const otherLisboa = createContext(dataOf(attributeSwitchback("city")), { [UNIT_TYPE]: "another-store" });
		otherLisboa.attribute("city", "Lisboa");

		expect(peekSchedule(lisboa)).toEqual(expectedSchedule("Lisboa"));
		expect(peekSchedule(otherLisboa)).toEqual(expectedSchedule("Lisboa"));
		expect(peekSchedule(porto)).toEqual(expectedSchedule("Porto"));
		expect(expectedSchedule("Lisboa")).not.toEqual(expectedSchedule("Porto"));
	});

	it("resolves nested and array paths and integer values", () => {
		const nested = createContext(dataOf(attributeSwitchback("geo/city")));
		nested.attribute("geo", { city: "Porto" });
		expect(peekSchedule(nested)).toEqual(expectedSchedule("Porto"));

		clock = ANCHOR;
		const array = createContext(dataOf(attributeSwitchback("items/1/city")));
		array.attribute("items", [{ city: "Lisbon" }, { city: "Faro" }]);
		expect(peekSchedule(array)).toEqual(expectedSchedule("Faro"));

		clock = ANCHOR;
		const integer = createContext(dataOf(attributeSwitchback("region")));
		integer.attribute("region", 42);
		expect(peekSchedule(integer)).toEqual(expectedSchedule("42"));

		// Values are read through their JSON encoding, as the Collector decodes them.
		clock = ANCHOR;
		const encoded = createContext(dataOf(attributeSwitchback("geo/city")));
		encoded.attribute("geo", { city: { toJSON: () => 42 } });
		expect(peekSchedule(encoded)).toEqual(expectedSchedule("42"));

		clock = ANCHOR + 10;
		const fraction = createContext(dataOf(attributeSwitchback("city")));
		fraction.attribute("city", 2.5);
		expect(fraction.treatment("exp_sb")).toEqual(0);
		expect(fraction.pending()).toEqual(0);
	});

	// Values that yield no cluster key serve variant 0, not eligible, record no exposure and never throw.
	it("is ineligible for values without a cluster key", () => {
		// 2.0 is the integer 2 in JS, so it is not in this list.
		for (const value of [null, undefined, "", true, 1.5, { a: "b" }, ["x"]]) {
			const context = createContext(dataOf(attributeSwitchback("city")));
			context.attribute("city", value);
			clock = ANCHOR + 10;
			expect([value, context.treatment("exp_sb")]).toEqual([value, 0]);
			// Variant 0's own config, like any ineligible assignment.
			expect([value, context.variableValue("sb.arm", -1)]).toEqual([value, 0]);
			expect([value, context.pending()]).toEqual([value, 0]);
		}

		const missing = createContext(dataOf(attributeSwitchback("geo/city")));
		missing.attribute("geo", { country: "PT" });
		clock = ANCHOR + 10;
		expect(missing.treatment("exp_sb")).toEqual(0);
		expect(missing.pending()).toEqual(0);
	});

	// A value with no JSON encoding has no cluster key.
	it("is ineligible for values with no JSON encoding", () => {
		const cyclic = {};
		cyclic.self = cyclic;
		for (const value of [
			cyclic,
			{ city: 10n },
			{
				toJSON: () => {
					throw new Error("no");
				},
			},
		]) {
			const context = createContext(dataOf(attributeSwitchback("geo/city")));
			context.attribute("geo", value);
			expect(context.treatment("exp_sb")).toEqual(0);
			expect(context.pending()).toEqual(0);
		}
	});

	// Unservable configurations serve an ineligible control to linked units, never a unit-assignment
	// draw, and record nothing.
	it("is an ineligible control for unservable configurations", () => {
		const experiments = ["items/0", "items/-1/city", "", "geo.city", "'city", '"city'].map(attributeSwitchback);
		for (const changes of [
			{ switchbackPeriodMs: null },
			{ switchbackPeriodMs: 0 },
			{ switchbackPeriodMs: -HOUR },
			{ split: [1] },
			{ switchbackClusters: { [UNIT_TYPE]: null } },
		]) {
			experiments.push({ ...attributeSwitchback("city"), ...changes });
		}
		for (const experiment of experiments) {
			const context = createContext(dataOf(experiment));
			context.attribute("city", "Lisboa");
			context.attribute("items", [{ city: "Lisbon" }]);
			for (let i = 0; i < 3; ++i) {
				clock = ANCHOR + i * HOUR;
				expect([experiment.switchbackClusters, context.treatment("exp_sb")]).toEqual([
					experiment.switchbackClusters,
					0,
				]);
			}
			expect(context.pending()).toEqual(0);
		}
	});

	// A missing or empty cluster map takes the legacy path: a unit of the declared unitType only
	// identifies an ineligible control (variant 0's config, no exposure); without one it does not apply.
	it("is only a legacy ineligible control with a missing or empty cluster map", () => {
		for (const clusters of [null, {}]) {
			const experiment = { ...attributeSwitchback("city"), switchbackClusters: clusters };
			const context = createContext(dataOf(experiment));
			context.attribute("city", "Lisboa");
			expect(context.treatment("exp_sb")).toEqual(0);
			expect(context.variableValue("sb.arm", -1)).toEqual(0);
			expect(context.pending()).toEqual(0);

			const other = createContext(dataOf(experiment), { user_id: "u1" });
			other.attribute("city", "Lisboa");
			expect(other.treatment("exp_sb")).toEqual(0);
			expect(other.variableValue("sb.arm", -1)).toEqual(-1);
			expect(other.pending()).toEqual(0);
		}
	});

	// The Collector reads the attribute set at or before the exposure instant, latest setAt first.
	it("uses the latest attribute set at or before the resolution instant", () => {
		const context = createContext(dataOf(attributeSwitchback("city")));
		clock = ANCHOR + 2 * HOUR;
		context.attribute("city", "Porto");
		clock = ANCHOR + 4 * HOUR;
		context.attribute("city", "Lisboa");

		clock = ANCHOR + HOUR;
		expect(context.peek("exp_sb")).toEqual(0);
		clock = ANCHOR + 3 * HOUR;
		expect(context.peek("exp_sb")).toEqual(expected("Porto", 3));
		clock = ANCHOR + 4 * HOUR;
		expect(context.peek("exp_sb")).toEqual(expected("Lisboa", 4));
	});

	// Within a period the cluster key is fixed at first resolution; the next period reads it again.
	it("does not reassign within the period after a mid-period setAttribute", () => {
		const context = createContext(dataOf(attributeSwitchback("city")));
		clock = ANCHOR + 10;
		context.attribute("city", "Lisboa");
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));

		clock = ANCHOR + 20;
		context.attribute("city", "Porto");
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));
		expect(context.peek("exp_sb")).toEqual(expected("Lisboa", 0));
		expect(context.pending()).toEqual(1);

		let differing = 0;
		for (let i = 1; i < 12; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.treatment("exp_sb")).toEqual(expected("Porto", i));
			if (expected("Porto", i) !== expected("Lisboa", i)) ++differing;
		}
		expect(differing).not.toEqual(0);
		expect(context.pending()).toEqual(12);
	});

	// A unit first resolved without a key stays ineligible (and unrecorded) for the rest of the period.
	it("waits for the next period after an ineligible resolution", async () => {
		const context = createContext(dataOf(attributeSwitchback("city")));
		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(0);
		context.attribute("city", "Lisboa");
		clock = ANCHOR + 20;
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.pending()).toEqual(0);

		clock = ANCHOR + HOUR;
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 1));
		expect(await publishExposures(context)).toEqual([exposure(expected("Lisboa", 1), ANCHOR + HOUR, true, false)]);
	});

	// A slot replaced through a traffic change still keeps the period's first key.
	it("keeps the period's key through traffic changes within the period", async () => {
		const context = createContext(dataOf(attributeSwitchback("city")));
		clock = ANCHOR + 10;
		context.attribute("city", "Lisboa");
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));

		clock = ANCHOR + 20;
		context.attribute("city", "Porto");
		await refreshTo(context, { ...attributeSwitchback("city"), trafficSplit: [1, 0] });
		expect(context.treatment("exp_sb")).toEqual(0);

		await refreshTo(context, attributeSwitchback("city"));
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));
		expect(context.pending()).toEqual(3);

		clock = ANCHOR + HOUR;
		expect(context.treatment("exp_sb")).toEqual(expected("Porto", 1));
	});

	// The cluster is resolved before traffic: a traffic miss of an eligible cluster is a recorded
	// ineligible exposure, and traffic restored later in the period serves the key read first.
	it("keeps the key when traffic is restored within the period", async () => {
		const context = createContext(dataOf({ ...attributeSwitchback("city"), trafficSplit: [1, 0] }));
		clock = ANCHOR + 10;
		context.attribute("city", "Faro");
		expect(context.treatment("exp_sb")).toEqual(0);

		clock = ANCHOR + 20;
		context.attribute("city", "Lisboa");
		await refreshTo(context, attributeSwitchback("city"));
		expect(expected("Faro", 0)).toEqual(1);
		expect(context.treatment("exp_sb")).toEqual(expected("Faro", 0));
		expect(await publishExposures(context)).toEqual([
			exposure(0, ANCHOR + 10, false, false),
			exposure(expected("Faro", 0), ANCHOR + 20, true, false),
		]);
	});

	// An audience change re-resolves the period slot (new exposure state) but keeps its key.
	it("keeps the period's key through an audience revalidation", async () => {
		const context = createContext(dataOf({ ...attributeSwitchback("city"), audience: GOLD_AUDIENCE }));
		clock = ANCHOR + 10;
		context.attribute("city", "Lisboa");
		context.attribute("tier", "gold");
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));

		clock = ANCHOR + 20;
		context.attribute("city", "Porto");
		context.attribute("tier", "silver");
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));

		expect(await publishExposures(context)).toEqual([
			exposure(expected("Lisboa", 0), ANCHOR + 10, true, false),
			exposure(expected("Lisboa", 0), ANCHOR + 20, true, true),
		]);
	});

	// A slot first resolved without a key carries that missing key into its replacement.
	it("keeps the missing key through an audience revalidation after an ineligible resolution", () => {
		const context = createContext(dataOf({ ...attributeSwitchback("city"), audience: GOLD_AUDIENCE }));
		clock = ANCHOR + 10;
		context.attribute("tier", "gold");
		expect(context.treatment("exp_sb")).toEqual(0);

		clock = ANCHOR + 20;
		context.attribute("city", "Faro");
		context.attribute("tier", "silver");
		expect(expected("Faro", 0)).toEqual(1);
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.pending()).toEqual(0);

		clock = ANCHOR + HOUR;
		expect(context.peek("exp_sb")).toEqual(expected("Faro", 1));
		// Period 1 of Faro is variant 0; period 2 is not, so the key is visibly read again.
		clock = ANCHOR + 2 * HOUR;
		expect(expected("Faro", 2)).toEqual(2);
		expect(context.peek("exp_sb")).toEqual(expected("Faro", 2));
	});

	// An ineligible slot is not read again when rebuilt in its period, whatever rebuilds it.
	it("keeps the missing key when a refresh rebuilds an ineligible slot", async () => {
		const context = createContext(dataOf(attributeSwitchback("city")));
		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(0);
		context.attribute("city", "Faro");
		await refreshTo(context, { ...attributeSwitchback("city"), trafficSplit: [0.0, 1.0, 0.0] });
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.pending()).toEqual(0);
	});

	it("invalidates the period when the cluster path changes", async () => {
		const context = createContext(dataOf(attributeSwitchback("city")));
		clock = ANCHOR + 10;
		context.attribute("city", "Lisboa");
		context.attribute("geo", { city: "Porto" });
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));
		expect(context.pending()).toEqual(1);

		await refreshTo(context, attributeSwitchback("city"));
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));
		expect(context.pending()).toEqual(1);

		await refreshTo(context, attributeSwitchback("geo/city"));
		expect(context.treatment("exp_sb")).toEqual(expected("Porto", 0));
		expect(context.pending()).toEqual(2);

		await refreshTo(context, { ...attributeSwitchback("geo/city"), switchbackClusterValues: ["Porto", "Faro"] });
		expect(context.treatment("exp_sb")).toEqual(expected("Porto", 0));
		expect(context.pending()).toEqual(3);
	});

	// Re-linking the experiment to another unit type re-keys the period and moves the exposure unit.
	it("re-keys the period when the linked unit type changes", async () => {
		const context = createContext(dataOf(attributeSwitchback("city")), { [UNIT_TYPE]: UID, user_id: "user-0002" });
		clock = ANCHOR + 1;
		context.attribute("city", "Lisboa");
		context.attribute("ucity", "Faro");
		expect(context.treatment("exp_sb")).toEqual(expected("Lisboa", 0));

		await refreshTo(context, { ...attributeSwitchback("ucity"), switchbackClusters: { user_id: "ucity" } });
		expect(context.treatment("exp_sb")).toEqual(expected("Faro", 0));
		expect((await publishExposures(context)).map((e) => e.unit)).toEqual([UNIT_TYPE, "user_id"]);
	});

	it("applies a custom assignment only to units with a cluster key", () => {
		const keyed = createContext(dataOf(attributeSwitchback("city")));
		keyed.attribute("city", "Lisboa");
		keyed.customAssignment("exp_sb", 2);
		expect(keyed.treatment("exp_sb")).toEqual(2);

		const unkeyed = createContext(dataOf(attributeSwitchback("city")));
		unkeyed.customAssignment("exp_sb", 2);
		expect(unkeyed.treatment("exp_sb")).toEqual(0);
		expect(unkeyed.pending()).toEqual(0);
	});

	// A split rule is revalidated over the serving unit: with the linked type differing from unitType, an
	// unrelated setAttribute keeps the rule-won slot and records no second exposure.
	it("revalidates a split rule over the serving unit without a second exposure", () => {
		const experiment = {
			...attributeSwitchback("city"),
			unitType: "user_id",
			assignmentRules: '{"rules":[{"type":"split","environments":[],"percentages":"34/33/33"}]}',
		};
		// store-20's draw differs between the rule's 34/33/33 and the experiment's equal thirds.
		const rule = [0.34, 0.33, 0.33];
		const store20 = new VariantAssigner(hashUnit("store-20"));
		expect(store20.assign(rule, SEED_HI, SEED_LO)).not.toEqual(store20.assign(experiment.split, SEED_HI, SEED_LO));
		for (const u of [0, 1, 2, 3, 20]) {
			const context = createContext(dataOf(experiment), { [UNIT_TYPE]: `store-${u}`, user_id: `user-${u}` });
			context.attribute("city", "Lisboa");
			const variant = context.treatment("exp_sb");
			expect(variant).toEqual(new VariantAssigner(hashUnit(`store-${u}`)).assign(rule, SEED_HI, SEED_LO));
			context.attribute("unrelated", u);
			expect(context.treatment("exp_sb")).toEqual(variant);
			expect(context.pending()).toEqual(1);
		}
	});

	// Inertness: a unit experiment ("unit" or absent) carrying every switchback field serves and
	// publishes exactly what the same experiment without them does; a split rule randomizes over its
	// unitType, never a cluster unit.
	it("ignores cluster fields on unit experiments", async () => {
		for (const type of ["unit", undefined]) {
			const unit = {
				...attributeSwitchback("city"),
				randomizationType: type,
				switchbackClusters: { user_id: "city", [UNIT_TYPE]: "'x" },
				switchbackClusterValues: ["nothing"],
				switchbackPeriodMs: 0,
				assignmentRules: '{"rules":[{"type":"split","environments":[],"percentages":"34/33/33"}]}',
			};
			const reference = { ...unit };
			for (const key of Object.keys(reference)) {
				if (key.indexOf("switchback") === 0) delete reference[key];
			}
			const published = [];
			for (const experiment of [unit, reference]) {
				const context = createContext(dataOf(experiment), { [UNIT_TYPE]: UID, user_id: "u" });
				context.attribute("city", "Lisboa");
				clock = ANCHOR - HOUR;
				const first = context.treatment("exp_sb");
				for (let i = 1; i < 6; ++i) {
					clock = ANCHOR - HOUR + i * HOUR;
					expect(context.treatment("exp_sb")).toEqual(first);
				}
				published.push(await publishExposures(context));
			}
			expect(published[0].length).toEqual(1);
			expect(published[0][0]).toEqual(
				expect.objectContaining({
					eligible: true,
					ruleOverride: true,
					exposedAt: ANCHOR - HOUR,
					unit: UNIT_TYPE,
				})
			);
			expect(published[0]).toEqual(published[1]);
		}
	});
});
