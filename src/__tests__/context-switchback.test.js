import Client from "../client";
import SDK from "../sdk";
import Context from "../context";
import { hashUnit } from "../utils";
import { VariantAssigner } from "../assigner";
import { assignSwitchbackPeriod } from "../switchback";
import { ContextPublisher } from "../publisher";
import { ContextDataProvider } from "../provider";
import { SDK_VERSION } from "../version";

jest.mock("../client");
jest.mock("../sdk");
jest.mock("../provider");
jest.mock("../publisher");

// Port of java-sdk's ContextSwitchbackTest (java-sdk#15) through the public Context API.
const UNIT_TYPE = "store_id";
const UID = "e791e240fcd3df7d238cfc285f475e8152fcc0ec";
// hashUnit(UID): the MD5/base64url string the Collector's UnitHasher also produces.
const UID_HASH = "pAE3a1i5Drs5mKRNq56adA";

const HOUR = 3600000;
const DAY = 24 * HOUR;
// 2026-01-01T00:00:00Z, hour aligned.
const ANCHOR = 1767225600000;

const SEED_HI = -5;
const SEED_LO = -7;

// The store unit's cluster value: attribute CLUSTER_PATH, set on every default context.
const CLUSTER_PATH = "store_key";
const CLUSTER_KEY = "store-42";
// Periods 0..11 of the raw cluster key "store-42" under seed (SEED_HI, SEED_LO), from an independent
// Python reference (murmur3 over the platform formulas) that reproduces every golden vector.
const EXPECTED_2_ARMS = [0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1];
const EXPECTED_3_ARMS = [0, 2, 1, 2, 1, 0, 1, 2, 0, 1, 0, 2];
const EXPECTED_10_ARMS = [8, 3, 7, 4, 2, 0, 5, 1, 9, 6, 3, 7];
// Same reference fed UID_HASH and the raw UID: what keying by the unit instead of the cluster would serve.
const UID_HASH_3_ARMS = [1, 2, 0, 2, 1, 0, 2, 0, 1, 1, 2, 0];
const UID_3_ARMS = [2, 0, 1, 0, 1, 2, 1, 2, 0, 0, 1, 2];

const ASSIGN_VARIANT_1 = '{"rules":[{"type":"assign","environments":[],"variant":1}]}';
const ASSIGN_VARIANT_2 = '{"rules":[{"type":"assign","environments":[],"variant":2}]}';
// An audience the default context never matches (no "tier" attribute).
const STRICT_GOLD_AUDIENCE = '{"filter":[{"eq":[{"var":"tier"},{"value":"gold"}]}]}';

const sdk = new SDK();
const client = new Client();
const publisher = new ContextPublisher();
const provider = new ContextDataProvider();

sdk.getContextDataProvider.mockReturnValue(provider);
sdk.getContextPublisher.mockReturnValue(publisher);
sdk.getClient.mockReturnValue(client);
sdk.getEventLogger.mockReturnValue(SDK.defaultEventLogger);
client.getAgent.mockReturnValue("absmartly-javascript-sdk");
client.getApplication.mockReturnValue({ name: "website", version: 0 });
client.getEnvironment.mockReturnValue("production");

let clock;
// When set, the next Date.now() returns it once, then reads fall back to `clock`.
let nextRead;

beforeEach(() => {
	clock = ANCHOR;
	nextRead = undefined;
	jest.spyOn(Date, "now").mockImplementation(() => {
		if (nextRead !== undefined) {
			const value = nextRead;
			nextRead = undefined;
			return value;
		}
		return clock;
	});
	publisher.publish.mockReset();
	publisher.publish.mockReturnValue(Promise.resolve());
	provider.getContextData.mockReset();
});

function switchback(id, experimentName, armCount, periodMs) {
	const split = [];
	const variants = [];
	for (let i = 0; i < armCount; ++i) {
		split.push(1 / armCount);
		variants.push({ name: String.fromCharCode(65 + i), config: `{"sb.arm":${i}}` });
	}
	return {
		id,
		name: experimentName,
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
		switchbackClusters: { [UNIT_TYPE]: CLUSTER_PATH },
		switchbackStartAt: ANCHOR,
		switchbackPeriodMs: periodMs,
		switchbackCarryoverDurationMs: 0,
		switchbackBurnInDurationMs: 0,
		switchbackBurnOutDurationMs: 0,
		switchbackDesignType: "balanced_block",
		switchbackEstimand: "global_average_treatment_effect",
	};
}

function sb(armCount, periodMs) {
	return switchback(1, "exp_sb", armCount, periodMs);
}

// The same experiment without any switchback field: a unit experiment.
function asUnit(experiment) {
	const unit = { ...experiment };
	for (const key of Object.keys(unit)) {
		if (key.indexOf("switchback") === 0 || key === "randomizationType") delete unit[key];
	}
	return unit;
}

function dataOf(...experiments) {
	return { experiments };
}

function createContext(data, units = { [UNIT_TYPE]: UID }, eventLogger = jest.fn()) {
	const context = new Context(sdk, { publishDelay: -1, refreshPeriod: 0, eventLogger }, { units }, data);
	context.attribute(CLUSTER_PATH, CLUSTER_KEY);
	return context;
}

function exposure(id, experimentName, variant, exposedAt, assigned, eligible, flags = {}) {
	return {
		id,
		name: experimentName,
		unit: UNIT_TYPE,
		exposedAt,
		variant,
		assigned,
		eligible,
		overridden: false,
		fullOn: false,
		custom: false,
		audienceMismatch: false,
		ruleOverride: false,
		...flags,
	};
}

// A rule win is published exactly like a unit experiment's: ruleOverride set, assigned false.
function ruleExposure(experimentName, variant, exposedAt) {
	return exposure(1, experimentName, variant, exposedAt, false, true, { ruleOverride: true });
}

function strictMismatchExposure(exposedAt) {
	return exposure(1, "exp_sb", 0, exposedAt, false, true, { audienceMismatch: true });
}

async function publishRequests(context, expectedPublishes = 1) {
	await context.publish();
	expect(publisher.publish).toHaveBeenCalledTimes(expectedPublishes);
	return publisher.publish.mock.calls.map((call) => call[0]);
}

async function publishExposures(context) {
	const requests = await publishRequests(context);
	return requests[0].exposures ?? [];
}

function peekSchedule(context, experimentName, periodMs, periods) {
	const result = [];
	for (let i = 0; i < periods; ++i) {
		clock = ANCHOR + i * periodMs;
		result.push(context.peek(experimentName));
	}
	return result;
}

async function refreshTo(context, ...experiments) {
	provider.getContextData.mockReturnValue(Promise.resolve(dataOf(...experiments)));
	await context.refresh();
}

// Holdout 11 for UID under seed (13, 111); split decides whether UID is held out.
function holdout(split) {
	return { id: 11, name: "holdout_a", unitType: UNIT_TYPE, iteration: 1, seedHi: 13, seedLo: 111, split };
}

const seedOf = (seedHi, seedLo) => [seedHi, seedLo];
const draw = (key, period, seed, arms) => assignSwitchbackPeriod(key, period, seed[0], seed[1], arms);

describe("switchback serving through Context", () => {
	it("keys the cluster by the raw attribute value, neither hashed nor the unit uid", () => {
		expect(hashUnit(UID)).toEqual(UID_HASH);

		const context = createContext(dataOf(sb(3, HOUR)));
		const served = peekSchedule(context, "exp_sb", HOUR, 12);

		expect(served).toEqual(EXPECTED_3_ARMS);
		expect(served).not.toEqual(UID_HASH_3_ARMS);
		expect(served).not.toEqual(UID_3_ARMS);
		const hashedKey = hashUnit(CLUSTER_KEY);
		let hashedDiffers = false;
		for (let i = 0; i < 12; ++i) {
			expect(draw(CLUSTER_KEY, i, seedOf(SEED_HI, SEED_LO), 3)).toEqual(served[i]);
			hashedDiffers = hashedDiffers || draw(hashedKey, i, seedOf(SEED_HI, SEED_LO), 3) !== served[i];
		}
		expect(hashedDiffers).toBe(true);
	});

	it("serves two-, three- and ten-arm permutations", () => {
		const context = createContext(
			dataOf(switchback(1, "exp_2", 2, HOUR), switchback(2, "exp_3", 3, HOUR), switchback(3, "exp_10", 10, HOUR))
		);

		expect(peekSchedule(context, "exp_2", HOUR, 12)).toEqual(EXPECTED_2_ARMS);
		expect(peekSchedule(context, "exp_3", HOUR, 12)).toEqual(EXPECTED_3_ARMS);
		expect(peekSchedule(context, "exp_10", HOUR, 12)).toEqual(EXPECTED_10_ARMS);
	});

	it("switches at the exact edge milliseconds of a one-hour period", () => {
		const context = createContext(dataOf(sb(2, HOUR)));

		for (const [now, expected] of [
			[ANCHOR - 1, 0],
			[ANCHOR, EXPECTED_2_ARMS[0]],
			[ANCHOR + HOUR - 1, EXPECTED_2_ARMS[0]],
			[ANCHOR + HOUR, EXPECTED_2_ARMS[1]],
			[ANCHOR + 3 * HOUR - 1, EXPECTED_2_ARMS[2]],
			[ANCHOR + 3 * HOUR, EXPECTED_2_ARMS[3]],
		]) {
			clock = now;
			expect([now, context.peek("exp_sb")]).toEqual([now, expected]);
		}
	});

	it("switches at the exact edge milliseconds of a 24-hour period", () => {
		const context = createContext(dataOf(sb(2, DAY)));

		for (const [now, expected] of [
			[ANCHOR - 1, 0],
			[ANCHOR, EXPECTED_2_ARMS[0]],
			[ANCHOR + HOUR, EXPECTED_2_ARMS[0]],
			[ANCHOR + DAY - 1, EXPECTED_2_ARMS[0]],
			[ANCHOR + DAY, EXPECTED_2_ARMS[1]],
			[ANCHOR + 4 * DAY - 1, EXPECTED_2_ARMS[3]],
			[ANCHOR + 4 * DAY, EXPECTED_2_ARMS[4]],
		]) {
			clock = now;
			expect([now, context.peek("exp_sb")]).toEqual([now, expected]);
		}
	});

	// The anchor is served without rounding; before it the experiment is an ineligible control that
	// records no exposure. An anchor that is not hour aligned is unservable in every period.
	it("treats an unaligned anchor as unservable and pre-anchor resolutions as ineligible", async () => {
		const aligned = switchback(1, "exp_aligned", 2, HOUR);
		aligned.switchbackStartAt = ANCHOR + HOUR;
		const unaligned = switchback(2, "exp_unaligned", 2, HOUR);
		const start = ANCHOR + 1234567;
		unaligned.switchbackStartAt = start;
		const context = createContext(dataOf(aligned, unaligned));

		for (const now of [ANCHOR, start - 1, start, ANCHOR + HOUR - 1]) {
			clock = now;
			expect(context.treatment("exp_aligned")).toEqual(0);
			expect(context.treatment("exp_unaligned")).toEqual(0);
		}
		expect(context.pending()).toEqual(0);
		for (let i = 1; i < 4; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.treatment("exp_aligned")).toEqual(EXPECTED_2_ARMS[i - 1]);
			expect(context.treatment("exp_unaligned")).toEqual(0);
			clock = start + i * HOUR;
			expect(context.treatment("exp_unaligned")).toEqual(0);
		}

		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_aligned", EXPECTED_2_ARMS[0], ANCHOR + HOUR, true, true),
			exposure(1, "exp_aligned", EXPECTED_2_ARMS[1], ANCHOR + 2 * HOUR, true, true),
			exposure(1, "exp_aligned", EXPECTED_2_ARMS[2], ANCHOR + 3 * HOUR, true, true),
		]);
	});

	// The Registry's anchor bounds: hour aligned and in [0, 10000-01-01T00:00:00Z). Unservable is an
	// ineligible control on resolution and nothing on publish.
	it("treats an anchor off the hour or out of bounds as unservable", async () => {
		const maxAnchor = 253402300800000;
		for (const startAt of [
			ANCHOR + 1,
			ANCHOR - 1,
			ANCHOR + 30 * 60000,
			ANCHOR + HOUR - 1,
			-HOUR,
			-1,
			maxAnchor,
			maxAnchor + HOUR,
			Number.MAX_SAFE_INTEGER - (Number.MAX_SAFE_INTEGER % HOUR),
		]) {
			const experiment = sb(2, HOUR);
			experiment.switchbackStartAt = startAt;
			// The cluster attribute is set at context creation, before every resolution below.
			clock = 0;
			const context = createContext(dataOf(experiment));
			for (const now of [0, ANCHOR, ANCHOR + 2 * HOUR + 1, startAt, startAt + HOUR, maxAnchor + DAY]) {
				clock = now;
				expect([startAt, now, context.treatment("exp_sb")]).toEqual([startAt, now, 0]);
				expect(context.variableValue("sb.arm", -1)).toEqual(0);
			}
			expect([startAt, context.pending()]).toEqual([startAt, 0]);
			await context.publish();
			expect(publisher.publish).not.toHaveBeenCalled();
		}

		// In-range hour-aligned anchors, including 0 and the last hour before the bound, serve.
		for (const startAt of [0, ANCHOR, maxAnchor - HOUR]) {
			const experiment = sb(2, HOUR);
			experiment.switchbackStartAt = startAt;
			clock = startAt + HOUR;
			const context = createContext(dataOf(experiment));
			expect([startAt, context.treatment("exp_sb")]).toEqual([startAt, EXPECTED_2_ARMS[1]]);
			expect(context.pending()).toEqual(1);
		}
	});

	it("is an ineligible control with no start and never falls back to unit assignment", () => {
		for (const startAt of [null, undefined]) {
			const experiment = sb(2, HOUR);
			experiment.switchbackStartAt = startAt;
			const context = createContext(dataOf(experiment));

			for (let i = 0; i < 4; ++i) {
				clock = ANCHOR + i * HOUR;
				expect(context.treatment("exp_sb")).toEqual(0);
				// Variant 0's own config, like any ineligible assignment.
				expect(context.variableValue("sb.arm", -1)).toEqual(0);
			}
			expect(context.pending()).toEqual(0);
		}
	});

	it("caches a period and rolls over to the next with one exposure each", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));

		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(1);
		clock = ANCHOR + HOUR - 1;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.peek("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(1);

		clock = ANCHOR + HOUR;
		expect(context.peek("exp_sb")).toEqual(EXPECTED_2_ARMS[1]);
		expect(context.pending()).toEqual(1);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[1]);
		expect(context.pending()).toEqual(2);
		clock = ANCHOR + HOUR + 30 * 60000;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[1]);
		expect(context.pending()).toEqual(2);

		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_sb", EXPECTED_2_ARMS[0], ANCHOR + 10, true, true),
			exposure(1, "exp_sb", EXPECTED_2_ARMS[1], ANCHOR + HOUR, true, true),
		]);
	});

	it("follows the period through variable lookups and exposes once per period", () => {
		const context = createContext(dataOf(sb(3, HOUR)));

		expect(context.variableKeys()).toEqual({ "sb.arm": ["exp_sb"] });
		expect(context.experiments()).toEqual(["exp_sb"]);

		for (let i = 0; i < 3; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.peekVariableValue("sb.arm", -1)).toEqual(EXPECTED_3_ARMS[i]);
			expect(context.variableValue("sb.arm", -1)).toEqual(EXPECTED_3_ARMS[i]);
			expect(context.variableValue("sb.arm", -1)).toEqual(EXPECTED_3_ARMS[i]);
			expect(context.treatment("exp_sb")).toEqual(EXPECTED_3_ARMS[i]);
		}
		expect(context.pending()).toEqual(3);
	});

	// No unit of a linked type: the experiment does not apply and records nothing. unitType is never a fallback.
	it("does not apply without a linked unit and never falls back to the unit type", async () => {
		const experiment = sb(2, HOUR);
		experiment.unitType = "user_id";
		const context = createContext(dataOf(experiment), { user_id: UID });

		for (let i = 0; i < 3; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.peek("exp_sb")).toEqual(0);
			expect(context.treatment("exp_sb")).toEqual(0);
			expect(context.variableValue("sb.arm", -1)).toEqual(-1);
		}
		expect(context.pending()).toEqual(0);

		// Setting a linked unit later makes the experiment apply.
		context.unit(UNIT_TYPE, UID);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[2]);
		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_sb", EXPECTED_2_ARMS[2], ANCHOR + 2 * HOUR, true, true),
		]);
	});

	it("serves the full-on variant in every period", async () => {
		const experiment = sb(3, HOUR);
		experiment.fullOnVariant = 2;
		const context = createContext(dataOf(experiment));

		for (let i = 0; i < 4; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.treatment("exp_sb")).toEqual(2);
		}
		const exposures = await publishExposures(context);
		expect(exposures.length).toEqual(4);
		for (const e of exposures) {
			expect(e).toEqual(expect.objectContaining({ variant: 2, fullOn: true }));
		}
	});

	it("lets an override and a custom assignment win in every period", async () => {
		const context = createContext(
			dataOf(switchback(1, "exp_override", 3, HOUR), switchback(2, "exp_custom", 3, HOUR))
		);
		context.override("exp_override", 7);
		context.customAssignment("exp_custom", 2);

		for (let i = 0; i < 3; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.treatment("exp_override")).toEqual(7);
			expect(context.treatment("exp_custom")).toEqual(2);
		}
		const exposures = await publishExposures(context);
		expect(exposures.length).toEqual(6);
		for (const e of exposures) {
			if (e.name === "exp_override") {
				expect(e).toEqual(exposure(1, "exp_override", 7, e.exposedAt, false, true, { overridden: true }));
			} else {
				expect(e).toEqual(exposure(2, "exp_custom", 2, e.exposedAt, true, true, { custom: true }));
			}
		}
	});

	// Traffic eligibility uses the serving unit's traffic hash, so it matches a unit-randomized twin
	// with the same traffic seed and stays fixed across periods.
	it("keeps traffic eligibility sticky per serving unit", async () => {
		let eligibleCount = 0;
		let ineligibleCount = 0;
		for (let u = 0; u < 24; ++u) {
			publisher.publish.mockClear();
			const experiment = switchback(1, "exp_sb", 2, HOUR);
			experiment.trafficSplit = [0.5, 0.5];
			const twin = asUnit(switchback(2, "exp_unit", 2, HOUR));
			twin.trafficSplit = [0.5, 0.5];

			clock = ANCHOR;
			const context = createContext(dataOf(experiment, twin), { [UNIT_TYPE]: `store_${u}` });
			context.treatment("exp_unit");
			for (let i = 0; i < 4; ++i) {
				clock = ANCHOR + i * HOUR;
				context.treatment("exp_sb");
			}

			const exposures = await publishExposures(context);
			expect(exposures.length).toEqual(5);
			const twinEligible = exposures[0].eligible;
			for (let i = 1; i < exposures.length; ++i) {
				expect(exposures[i].name).toEqual("exp_sb");
				expect(exposures[i].eligible).toEqual(twinEligible);
				if (!twinEligible) expect(exposures[i].variant).toEqual(0);
			}
			if (twinEligible) ++eligibleCount;
			else ++ineligibleCount;
		}
		expect(eligibleCount).toBeGreaterThan(0);
		expect(ineligibleCount).toBeGreaterThan(0);
	});

	it("leaves unit experiments unaffected", () => {
		const unit = sb(2, HOUR);
		unit.randomizationType = "unit";
		const absent = asUnit(switchback(2, "exp_absent", 2, HOUR));
		const unknown = switchback(3, "exp_unknown", 2, HOUR);
		unknown.randomizationType = "something_new";

		const context = createContext(dataOf(unit, absent, unknown));
		const variant = context.treatment("exp_sb");
		const absentVariant = context.treatment("exp_absent");
		const unknownVariant = context.treatment("exp_unknown");
		for (let i = 1; i < 6; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.treatment("exp_sb")).toEqual(variant);
			expect(context.treatment("exp_absent")).toEqual(absentVariant);
			expect(context.treatment("exp_unknown")).toEqual(unknownVariant);
		}
		expect(context.pending()).toEqual(3);
	});

	it("starts a new epoch when grid fields change, but not for analysis-only fields", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(1);

		const burnsChanged = sb(2, HOUR);
		burnsChanged.switchbackBurnInDurationMs = 600000;
		burnsChanged.switchbackBurnOutDurationMs = 300000;
		burnsChanged.switchbackCarryoverDurationMs = 900000;
		burnsChanged.switchbackEstimand = "other";
		burnsChanged.seedHi = 99;
		burnsChanged.split = [0.9, 0.1];
		await refreshTo(context, burnsChanged);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(1);

		// Same period index 0 under both grids, so only the identity comparison can invalidate.
		await refreshTo(context, sb(2, 2 * HOUR));
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(2);

		const designChanged = sb(2, 2 * HOUR);
		designChanged.switchbackDesignType = "other_design";
		await refreshTo(context, designChanged);
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(3);

		const toUnit = sb(2, 2 * HOUR);
		toUnit.randomizationType = "unit";
		await refreshTo(context, toUnit);
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(4);

		await refreshTo(context, sb(2, 2 * HOUR));
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(5);

		// The cluster map (types, paths and their order) and the allow-list are identity.
		const pathChanged = sb(2, 2 * HOUR);
		pathChanged.switchbackClusters = { [UNIT_TYPE]: "'store_key'" };
		await refreshTo(context, pathChanged);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(6);

		const linkAdded = sb(2, 2 * HOUR);
		linkAdded.switchbackClusters = { [UNIT_TYPE]: "'store_key'", device_id: "city" };
		await refreshTo(context, linkAdded);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(7);

		const linksReordered = sb(2, 2 * HOUR);
		linksReordered.switchbackClusters = { device_id: "city", [UNIT_TYPE]: "'store_key'" };
		await refreshTo(context, linksReordered);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(8);

		const valuesSet = sb(2, 2 * HOUR);
		valuesSet.switchbackClusters = linksReordered.switchbackClusters;
		valuesSet.switchbackClusterValues = [CLUSTER_KEY];
		await refreshTo(context, valuesSet);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(9);

		// An unrelated unitType edit is not identity: switchbacks with a readable map never read it.
		const unitTypeChanged = { ...valuesSet, unitType: "anything" };
		await refreshTo(context, unitTypeChanged);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(9);
	});

	it("starts the grid when a refresh sets the anchor", async () => {
		const pending = sb(2, HOUR);
		pending.switchbackStartAt = null;
		const context = createContext(dataOf(pending));
		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(0);

		await refreshTo(context, sb(2, HOUR));
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(1);
	});

	// Holdouts never apply to a switchback: a holdout that would hold the unit out neither suppresses
	// it nor records its own exposure through it.
	it("never applies holdouts", async () => {
		for (const split of [
			[0.1, 0.9],
			[0, 1],
			[1, 0, 0],
		]) {
			publisher.publish.mockClear();
			clock = ANCHOR;
			const covered = sb(2, HOUR);
			covered.holdoutIds = [11];
			const data = { ...dataOf(covered), holdouts: [holdout(split)] };
			const context = createContext(data);
			for (let i = 0; i < 3; ++i) {
				clock = ANCHOR + i * HOUR;
				expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[i]);
				expect(context.variableValue("sb.arm", -1)).toEqual(EXPECTED_2_ARMS[i]);
				expect(context.peekVariableValue("sb.arm", -1)).toEqual(EXPECTED_2_ARMS[i]);
			}
			expect(await publishExposures(context)).toEqual([
				exposure(1, "exp_sb", EXPECTED_2_ARMS[0], ANCHOR, true, true),
				exposure(1, "exp_sb", EXPECTED_2_ARMS[1], ANCHOR + HOUR, true, true),
				exposure(1, "exp_sb", EXPECTED_2_ARMS[2], ANCHOR + 2 * HOUR, true, true),
			]);
		}
	});

	// Assignment rules are evaluated first for a switchback too, so a matching rule assigns its
	// variant even before the anchor, recorded with ruleOverride.
	it("lets an assignment rule override the schedule, before the anchor too", async () => {
		const experiment = sb(2, HOUR);
		experiment.assignmentRules = ASSIGN_VARIANT_1;
		for (let u = 0; u < 10; ++u) {
			publisher.publish.mockClear();
			clock = ANCHOR - 1;
			const context = createContext(dataOf(experiment), { [UNIT_TYPE]: `user-${u}` });
			expect(context.treatment("exp_sb")).toEqual(1);
			expect(context.variableValue("sb.arm", -1)).toEqual(1);
			for (let i = 0; i < 4; ++i) {
				clock = ANCHOR + i * HOUR;
				expect(context.treatment("exp_sb")).toEqual(1);
			}
			const exposures = await publishExposures(context);
			expect(exposures).toEqual([
				ruleExposure("exp_sb", 1, ANCHOR - 1),
				...[0, 1, 2, 3].map((i) => ruleExposure("exp_sb", 1, ANCHOR + i * HOUR)),
			]);
		}
	});

	// An unservable schedule only replaces the schedule draw: full-on and rules still apply.
	it("lets full-on and rules apply with an unservable schedule", async () => {
		const fullOn = switchback(1, "sb_full_on", 2, HOUR);
		fullOn.switchbackStartAt = null;
		fullOn.fullOnVariant = 1;
		const rules = switchback(2, "sb_rules", 2, HOUR);
		rules.switchbackPeriodMs = 0;
		rules.assignmentRules = ASSIGN_VARIANT_1;
		const unalignedRules = switchback(3, "sb_unaligned_rules", 2, HOUR);
		unalignedRules.switchbackStartAt = ANCHOR + 1;
		unalignedRules.assignmentRules = ASSIGN_VARIANT_1;
		const context = createContext(dataOf(fullOn, rules, unalignedRules), { [UNIT_TYPE]: "15" });

		expect(context.treatment("sb_full_on")).toEqual(1);
		expect(context.treatment("sb_rules")).toEqual(1);
		expect(context.treatment("sb_unaligned_rules")).toEqual(1);
		expect(await publishExposures(context)).toEqual([
			exposure(1, "sb_full_on", 1, ANCHOR, true, true, { fullOn: true }),
			exposure(2, "sb_rules", 1, ANCHOR, false, true, { ruleOverride: true }),
			exposure(3, "sb_unaligned_rules", 1, ANCHOR, false, true, { ruleOverride: true }),
		]);
	});

	it("does not evaluate assignment rules for an ineligible cluster", () => {
		const experiment = sb(2, HOUR);
		experiment.assignmentRules = ASSIGN_VARIANT_1;
		experiment.switchbackClusterValues = ["other-store"];
		const context = createContext(dataOf(experiment));
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.variableValue("sb.arm", -1)).toEqual(0);
		expect(context.pending()).toEqual(0);
	});

	// A split rule randomizes over the serving unit, not over the payload's unitType.
	it("randomizes a split rule over the serving unit", async () => {
		const experiment = sb(2, HOUR);
		experiment.unitType = "user_id";
		experiment.assignmentRules = '{"rules":[{"type":"split","environments":[],"percentages":"50/50"}]}';
		let ones = 0;
		for (let u = 0; u < 32; ++u) {
			publisher.publish.mockClear();
			const uid = `store-${u}`;
			const expected = new VariantAssigner(hashUnit(uid)).assign([0.5, 0.5], SEED_HI, SEED_LO);
			const context = createContext(dataOf(experiment), { [UNIT_TYPE]: uid, user_id: "fixed-user" });
			expect([uid, context.treatment("exp_sb")]).toEqual([uid, expected]);
			expect(await publishExposures(context)).toEqual([ruleExposure("exp_sb", expected, ANCHOR)]);
			ones += expected;
		}
		expect(ones).toBeGreaterThan(0);
		expect(ones).toBeLessThan(32);
	});

	it("records a strict audience mismatch as control", async () => {
		const experiment = sb(2, HOUR);
		experiment.audience = STRICT_GOLD_AUDIENCE;
		experiment.audienceStrict = true;
		const context = createContext(dataOf(experiment));
		clock = ANCHOR + HOUR;
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(await publishExposures(context)).toEqual([strictMismatchExposure(ANCHOR + HOUR)]);
	});

	// Runs in period 1, whose draw is 1, so the variant 0 is the strict mismatch's control.
	it("publishes a strict audience mismatch exactly", async () => {
		const experiment = sb(2, HOUR);
		experiment.audience = STRICT_GOLD_AUDIENCE;
		experiment.audienceStrict = true;
		const context = createContext(dataOf(experiment));
		expect(EXPECTED_2_ARMS[1]).toEqual(1);
		clock = ANCHOR + HOUR + 5;
		context.treatment("exp_sb");
		clock = ANCHOR + HOUR + 9;

		const [request] = await publishRequests(context);
		expect(JSON.stringify(request)).toEqual(
			JSON.stringify({
				publishedAt: ANCHOR + HOUR + 9,
				units: [{ type: UNIT_TYPE, uid: UID_HASH }],
				hashed: true,
				sdkVersion: SDK_VERSION,
				exposures: [strictMismatchExposure(ANCHOR + HOUR + 5)],
				attributes: [{ name: CLUSTER_PATH, value: CLUSTER_KEY, setAt: ANCHOR }],
			})
		);
	});

	// The audience check comes before the period check, so a strict mismatch before the anchor or
	// with an unservable schedule is still recorded.
	it("records a strict audience mismatch before the anchor and with an unservable schedule", async () => {
		for (const [startAt, now] of [
			[ANCHOR, ANCHOR - 1],
			[null, ANCHOR + HOUR + 3],
		]) {
			publisher.publish.mockClear();
			const experiment = sb(2, HOUR);
			experiment.audience = STRICT_GOLD_AUDIENCE;
			experiment.audienceStrict = true;
			experiment.switchbackStartAt = startAt;
			clock = now;
			const context = createContext(dataOf(experiment));
			expect(context.treatment("exp_sb")).toEqual(0);
			expect(await publishExposures(context)).toEqual([strictMismatchExposure(now)]);
		}
	});

	// A missing or unreadable cluster map takes the legacy path, an ineligible control before the
	// audience is evaluated, so a strict mismatch there records nothing.
	it("records nothing for a strict audience mismatch with a missing or unreadable cluster map", () => {
		for (const clusters of [null, undefined, {}, { [UNIT_TYPE]: "'geo" }]) {
			const experiment = sb(2, HOUR);
			experiment.audience = STRICT_GOLD_AUDIENCE;
			experiment.audienceStrict = true;
			experiment.switchbackClusters = clusters;
			clock = ANCHOR + HOUR + 3;
			const context = createContext(dataOf(experiment));
			expect([clusters, context.treatment("exp_sb")]).toEqual([clusters, 0]);
			expect([clusters, context.pending()]).toEqual([clusters, 0]);
		}
	});

	// A strict-mismatched switchback is not assigned, so on a shared variable key it gives way to the
	// next experiment that declares the key, as a unit experiment does.
	it("gives way on a shared variable key when strict-mismatched", async () => {
		const experiment = sb(2, HOUR);
		experiment.audience = STRICT_GOLD_AUDIENCE;
		experiment.audienceStrict = true;
		const unit = asUnit(switchback(2, "exp_unit", 2, HOUR));
		unit.variants = [
			{ name: "A", config: '{"sb.arm":10}' },
			{ name: "B", config: '{"sb.arm":11}' },
		];
		unit.fullOnVariant = 1;
		clock = ANCHOR + HOUR + 3;
		const context = createContext(dataOf(experiment, unit));
		expect(context.variableKeys()).toEqual({ "sb.arm": ["exp_sb", "exp_unit"] });

		expect(context.peekVariableValue("sb.arm", -1)).toEqual(11);
		expect(context.pending()).toEqual(0);
		expect(context.variableValue("sb.arm", -1)).toEqual(11);
		// Like a unit experiment on the key, the strict-mismatched switchback visited first is exposed too.
		expect(await publishExposures(context)).toEqual([
			strictMismatchExposure(ANCHOR + HOUR + 3),
			exposure(2, "exp_unit", 1, ANCHOR + HOUR + 3, true, true, { fullOn: true }),
		]);
	});

	it("returns the default value on a variable key it holds alone when strict-mismatched", () => {
		const experiment = sb(2, HOUR);
		experiment.audience = STRICT_GOLD_AUDIENCE;
		experiment.audienceStrict = true;
		clock = ANCHOR + HOUR + 3;
		const context = createContext(dataOf(experiment));
		expect(context.peekVariableValue("sb.arm", -1)).toEqual(-1);
		expect(context.pending()).toEqual(0);
		expect(context.variableValue("sb.arm", -1)).toEqual(-1);
	});

	// The SWITCHBACK.md "Exposure flags" table: every branch an eligible-cluster switchback shares with a
	// unit experiment publishes the same flags. Columns: assigned, eligible, overridden, fullOn,
	// custom, audienceMismatch, ruleOverride. The variant is served at ANCHOR + 2 * HOUR + 3 (period 2,
	// whose 3-arm draw is 1); forced variants are 2, which differs from both control and the draw.
	describe.each([
		["override", [false, true, true, false, false, false, false], 2],
		["override over strict mismatch", [false, true, true, false, false, false, false], 2],
		["rule", [false, true, false, false, false, false, true], 2],
		["rule over strict mismatch", [false, true, false, false, false, false, true], 2],
		["strict mismatch", [false, true, false, false, false, true, false], 0],
		["strict mismatch over full-on", [false, true, false, false, false, true, false], 0],
		["strict mismatch over traffic miss", [false, true, false, false, false, true, false], 0],
		["non-strict mismatch", [true, true, false, false, false, true, false], EXPECTED_3_ARMS[2]],
		["full-on", [true, true, false, true, false, false, false], 2],
		["traffic miss", [true, false, false, false, false, false, false], 0],
		["custom", [true, true, false, false, true, false, false], 2],
		["draw", [true, true, false, false, false, false, false], EXPECTED_3_ARMS[2]],
	])("exposure flags for %s", (branch, flags, expectedVariant) => {
		const configure = (experiment) => {
			if (branch.indexOf("strict mismatch") >= 0) {
				experiment.audience = STRICT_GOLD_AUDIENCE;
				experiment.audienceStrict = branch !== "non-strict mismatch";
			}
			if (branch === "strict mismatch over full-on" || branch === "full-on") experiment.fullOnVariant = 2;
			if (branch.indexOf("traffic miss") >= 0) experiment.trafficSplit = [1, 0];
			if (branch.indexOf("rule") === 0) experiment.assignmentRules = ASSIGN_VARIANT_2;
			return experiment;
		};
		const exposeOnce = async (experiment) => {
			publisher.publish.mockClear();
			const context = createContext(dataOf(configure(experiment)));
			if (branch.indexOf("override") === 0) context.override("exp_parity", 2);
			if (branch === "custom") context.customAssignment("exp_parity", 2);
			context.treatment("exp_parity");
			const exposures = await publishExposures(context);
			expect(exposures.length).toEqual(1);
			return exposures[0];
		};
		const flagsOf = (e) => [
			e.assigned,
			e.eligible,
			e.overridden,
			e.fullOn,
			e.custom,
			e.audienceMismatch,
			e.ruleOverride,
		];

		it("matches a unit experiment and the table", async () => {
			clock = ANCHOR + 2 * HOUR + 3;
			expect(EXPECTED_3_ARMS[2]).toEqual(1);

			const unitExposure = await exposeOnce(asUnit(switchback(1, "exp_parity", 3, HOUR)));
			const switchbackExposure = await exposeOnce(switchback(1, "exp_parity", 3, HOUR));

			expect(flagsOf(unitExposure)).toEqual(flags);
			expect(flagsOf(switchbackExposure)).toEqual(flags);
			expect(switchbackExposure.variant).toEqual(expectedVariant);
			if (branch !== "draw" && branch !== "non-strict mismatch") {
				expect(unitExposure.variant).toEqual(expectedVariant);
			}
			expect([switchbackExposure.id, switchbackExposure.name, switchbackExposure.exposedAt]).toEqual([
				unitExposure.id,
				unitExposure.name,
				unitExposure.exposedAt,
			]);
		});
	});

	// A traffic miss on an eligible cluster is recorded (eligible=false, variant 0, under the serving
	// unit); an ineligible cluster records nothing.
	it("records a traffic miss on an eligible cluster as ineligible", async () => {
		const miss = switchback(1, "exp_miss", 2, HOUR);
		miss.trafficSplit = [1, 0];
		const ineligibleCluster = switchback(2, "exp_cluster_ineligible", 2, HOUR);
		ineligibleCluster.trafficSplit = [1, 0];
		ineligibleCluster.switchbackClusterValues = ["other-store"];
		const context = createContext(dataOf(miss, ineligibleCluster));
		clock = ANCHOR + 2 * HOUR + 3;
		expect(context.treatment("exp_miss")).toEqual(0);
		expect(context.treatment("exp_cluster_ineligible")).toEqual(0);
		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_miss", 0, ANCHOR + 2 * HOUR + 3, true, false),
		]);
	});

	it("keeps custom field values and unit lookups working", () => {
		const experiment = sb(2, HOUR);
		experiment.customFieldValues = [{ name: "country", value: "PT", type: "string" }];
		const context = createContext(dataOf(experiment));
		expect(context.getUnit(UNIT_TYPE)).toEqual(UID);
		expect(context.customFieldKeys()).toEqual(["country"]);
		expect(context.customFieldValue("exp_sb", "country")).toEqual("PT");
		expect(context.customFieldValue("exp_sb", "missing")).toBeNull();
	});

	it("keeps at most two period slots per experiment", () => {
		const context = createContext(dataOf(sb(2, HOUR), switchback(2, "exp_other", 2, HOUR)));
		for (let i = 0; i < 50; ++i) {
			clock = ANCHOR + i * HOUR;
			context.treatment("exp_sb");
			context.peek("exp_other");
		}
		expect(Object.keys(context._assignments).length).toEqual(4);
		expect(context.pending()).toEqual(50);
	});

	it("does not use the unit type for assignment", async () => {
		const experiment = sb(2, HOUR);
		experiment.unitType = "user_id";
		const context = createContext(dataOf(experiment), { [UNIT_TYPE]: UID, user_id: "u1" });
		for (let i = 0; i < 3; ++i) {
			clock = ANCHOR + i * HOUR;
			expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[i]);
		}
		const exposures = await publishExposures(context);
		expect(exposures.map((e) => e.unit)).toEqual([UNIT_TYPE, UNIT_TYPE, UNIT_TYPE]);
	});

	// The publish payload carries no switchback-specific field, and the cluster attribute is published
	// timestamped: the Collector re-resolves the cluster at exposedAt from it.
	it("publishes no new fields", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 5;
		context.treatment("exp_sb");
		clock = ANCHOR + HOUR + 7;
		context.treatment("exp_sb");
		clock = ANCHOR + HOUR + 9;

		const [request] = await publishRequests(context);
		expect(JSON.stringify(request)).toEqual(
			JSON.stringify({
				publishedAt: ANCHOR + HOUR + 9,
				units: [{ type: UNIT_TYPE, uid: UID_HASH }],
				hashed: true,
				sdkVersion: SDK_VERSION,
				exposures: [
					exposure(1, "exp_sb", EXPECTED_2_ARMS[0], ANCHOR + 5, true, true),
					exposure(1, "exp_sb", EXPECTED_2_ARMS[1], ANCHOR + HOUR + 7, true, true),
				],
				attributes: [{ name: CLUSTER_PATH, value: CLUSTER_KEY, setAt: ANCHOR }],
			})
		);
		expect(EXPECTED_2_ARMS[0]).not.toEqual(EXPECTED_2_ARMS[1]);
	});

	it("keeps one exposure per period across flushes", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR;
		context.treatment("exp_sb");
		await context.publish();
		clock = ANCHOR + 1;
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(0);
		clock = ANCHOR + HOUR;
		context.treatment("exp_sb");

		const requests = await publishRequests(context, 2);
		expect(requests.map((r) => r.exposures.map((e) => e.variant))).toEqual([
			[EXPECTED_2_ARMS[0]],
			[EXPECTED_2_ARMS[1]],
		]);
	});

	// The clock crosses into period 1 between the resolution's reading and any later one; the exposure
	// still carries the reading that selected period 0.
	it("stamps a treatment exposure with the resolution instant", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + HOUR;
		nextRead = ANCHOR + HOUR - 1;

		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_sb", EXPECTED_2_ARMS[0], ANCHOR + HOUR - 1, true, true),
		]);
	});

	it("stamps a variable exposure with the resolution instant", async () => {
		const covered = sb(2, HOUR);
		covered.holdoutIds = [11];
		const context = createContext({ ...dataOf(covered), holdouts: [holdout([0, 1])] });
		clock = ANCHOR + HOUR;
		nextRead = ANCHOR + HOUR - 1;

		expect(context.variableValue("sb.arm", -1)).toEqual(EXPECTED_2_ARMS[0]);
		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_sb", EXPECTED_2_ARMS[0], ANCHOR + HOUR - 1, true, true),
		]);
	});

	// One reading per variable lookup: every switchback visited on the key resolves and exposes at it.
	it("resolves every experiment on a variable key at one instant", async () => {
		const first = switchback(1, "exp_first", 2, HOUR);
		first.audience = STRICT_GOLD_AUDIENCE;
		first.audienceStrict = true;
		const second = switchback(2, "exp_second", 2, HOUR);
		const context = createContext(dataOf(first, second));
		clock = ANCHOR + HOUR;
		nextRead = ANCHOR + HOUR - 1;

		expect(context.variableValue("sb.arm", -1)).toEqual(EXPECTED_2_ARMS[0]);
		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_first", 0, ANCHOR + HOUR - 1, false, true, { audienceMismatch: true }),
			exposure(2, "exp_second", EXPECTED_2_ARMS[0], ANCHOR + HOUR - 1, true, true),
		]);
	});

	// A peek caches the period's assignment without exposing; the later treatment exposes at its own instant.
	it("stamps an exposure after a peek with the exposing call's instant", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 10;
		expect(context.peek("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		clock = ANCHOR + 20 * 60000;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_sb", EXPECTED_2_ARMS[0], ANCHOR + 20 * 60000, true, true),
		]);
	});

	// Unit experiments keep stamping at enqueue time and read the clock as before.
	it("leaves unit exposure timing unchanged", async () => {
		const unit = sb(2, HOUR);
		unit.randomizationType = "unit";
		const context = createContext(dataOf(unit));
		clock = ANCHOR + HOUR;
		nextRead = ANCHOR + HOUR - 1;

		const variant = context.treatment("exp_sb");
		expect(await publishExposures(context)).toEqual([
			exposure(1, "exp_sb", variant, ANCHOR + HOUR - 1, true, true),
		]);
	});

	it("reads the clock no more often for unit experiments in a payload without switchbacks", () => {
		const context = createContext(dataOf(asUnit(sb(2, HOUR))));
		Date.now.mockClear();
		context.peek("exp_sb");
		context.peekVariableValue("sb.arm", -1);
		context.variableValue("sb.arm", -1);
		context.treatment("exp_sb");
		// One reading, for the one exposure, as before switchbacks.
		expect(Date.now).toHaveBeenCalledTimes(1);
	});

	// A grid change that lowers the current index below the retained ones must not evict the entry
	// it just installed.
	it("exposes once after a grid refresh to a lower index", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 99 * HOUR;
		context.treatment("exp_sb");
		clock = ANCHOR + 100 * HOUR;
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(2);

		const restarted = sb(2, HOUR);
		restarted.switchbackStartAt = ANCHOR + 100 * HOUR;
		await refreshTo(context, restarted);
		for (let i = 0; i < 3; ++i) {
			expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		}
		expect(context.pending()).toEqual(3);
	});

	it("exposes once after a period-length refresh to a lower index", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 100 * HOUR;
		context.treatment("exp_sb");
		clock = ANCHOR + 101 * HOUR;
		context.treatment("exp_sb");

		await refreshTo(context, sb(2, 200 * HOUR));
		context.treatment("exp_sb");
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(3);
	});

	// Rewinding the clock across retained periods re-exposes each re-entered evicted period at most once.
	it("re-exposes an evicted period at most once after a clock rewind", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		for (let i = 0; i < 3; ++i) {
			clock = ANCHOR + i * HOUR;
			context.treatment("exp_sb");
		}
		expect(context.pending()).toEqual(3);

		clock = ANCHOR;
		for (let i = 0; i < 3; ++i) {
			expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		}
		expect(context.pending()).toEqual(4);

		// Retained {0, 2}: period 2 is still deduplicated, period 1 was evicted.
		clock = ANCHOR + 2 * HOUR;
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(4);
		clock = ANCHOR + HOUR;
		for (let i = 0; i < 3; ++i) {
			expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[1]);
		}
		expect(context.pending()).toEqual(5);

		const exposures = await publishExposures(context);
		expect(exposures[3]).toEqual(exposure(1, "exp_sb", EXPECTED_2_ARMS[0], ANCHOR, true, true));
		expect(exposures[4]).toEqual(exposure(1, "exp_sb", EXPECTED_2_ARMS[1], ANCHOR + HOUR, true, true));
	});

	// An overridden switchback slot is re-resolved on a grid change; the override still wins and the
	// holdout never fires.
	it("re-resolves an override when the grid changes", async () => {
		const original = sb(3, HOUR);
		original.holdoutIds = [11];
		const context = createContext({ ...dataOf(original), holdouts: [holdout([0, 1])] });
		context.override("exp_sb", 2);

		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(2);
		expect(context.variableValue("sb.arm", -1)).toEqual(2);
		expect(context.pending()).toEqual(1);

		// Same index 0 under the new period length; variant 2 now carries a different value.
		const regridded = sb(3, 2 * HOUR);
		regridded.holdoutIds = [11];
		regridded.variants[2] = { name: "C", config: '{"sb.arm":22}' };
		provider.getContextData.mockReturnValue(Promise.resolve({ ...dataOf(regridded), holdouts: [holdout([0, 1])] }));
		await context.refresh();

		expect(context.treatment("exp_sb")).toEqual(2);
		expect(context.variableValue("sb.arm", -1)).toEqual(22);
		expect(context.pending()).toEqual(2);

		const exposures = await publishExposures(context);
		expect(exposures).toEqual([
			exposure(1, "exp_sb", 2, ANCHOR + 10, false, true, { overridden: true }),
			exposure(1, "exp_sb", 2, ANCHOR + 10, false, true, { overridden: true }),
		]);
	});

	// Each identity transition is a new epoch: returning to an identical grid re-resolves.
	it("re-resolves after switchback to unit to identical switchback", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(1);

		const toUnit = sb(2, HOUR);
		toUnit.randomizationType = "unit";
		await refreshTo(context, toUnit);
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(2);

		await refreshTo(context, sb(2, HOUR));
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(3);
	});

	it("re-resolves a removed and restored switchback", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 10;
		context.treatment("exp_sb");

		await refreshTo(context);
		// An experiment missing from the data is exposed as variant 0, as before.
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.pending()).toEqual(2);

		await refreshTo(context, sb(2, HOUR));
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(3);
	});

	it("drops the pre-anchor slot when the grid changes", async () => {
		const gridA = sb(2, HOUR);
		gridA.switchbackStartAt = ANCHOR + 10 * HOUR;
		const context = createContext(dataOf(gridA));
		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.pending()).toEqual(0);

		await refreshTo(context, sb(2, HOUR));
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(1);

		await refreshTo(context, gridA);
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.pending()).toEqual(1);
		expect(context.variableValue("sb.arm", -1)).toEqual(0);
		expect(context.pending()).toEqual(1);
	});

	// The unit path reads the bare-name slot, so the pre-anchor switchback slot must not survive the
	// switch to a unit experiment, and no period slot outlives its epoch.
	it("drops every switchback slot when the experiment becomes a unit experiment", async () => {
		const preAnchor = sb(2, HOUR);
		preAnchor.switchbackStartAt = ANCHOR + 10 * HOUR;
		const context = createContext(dataOf(preAnchor, switchback(2, "exp_periods", 2, HOUR)));
		clock = ANCHOR + 10;
		expect(context.peek("exp_sb")).toEqual(0);
		expect(context.peek("exp_periods")).toEqual(EXPECTED_2_ARMS[0]);
		clock = ANCHOR + HOUR;
		expect(context.peek("exp_periods")).toEqual(EXPECTED_2_ARMS[1]);
		expect(Object.keys(context._assignments).sort()).toEqual([
			"exp_periods\u001f0",
			"exp_periods\u001f1",
			"exp_sb",
		]);

		const unit = asUnit(sb(2, HOUR));
		const periodsUnit = asUnit(switchback(2, "exp_periods", 2, HOUR));
		await refreshTo(context, unit, periodsUnit);
		const expected = new VariantAssigner(hashUnit(UID)).assign(unit.split, unit.seedHi, unit.seedLo);
		expect(context.treatment("exp_sb")).toEqual(expected);
		context.treatment("exp_periods");
		expect(context.pending()).toEqual(2);
		expect(Object.keys(context._assignments).sort()).toEqual(["exp_periods", "exp_sb"]);
		expect((await publishExposures(context)).map((e) => [e.name, e.variant, e.assigned])).toEqual([
			["exp_sb", expected, true],
			["exp_periods", expect.any(Number), true],
		]);
	});

	it("drops the slots of an earlier epoch when the same period is resolved again", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 10;
		context.treatment("exp_sb");
		const regridded = sb(2, HOUR);
		regridded.switchbackDesignType = "other";
		await refreshTo(context, regridded);
		// Same cache key (period 0), new epoch: resolved and exposed again.
		context.peek("exp_sb");
		expect(context.pending()).toEqual(1);
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(2);
	});

	// Epochs are reconciled lazily; an intermediate state never looked up still ends the epoch.
	it("re-resolves after transitions without an intervening lookup", async () => {
		const context = createContext(dataOf(sb(2, HOUR)));
		clock = ANCHOR + 10;
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(1);

		const toUnit = sb(2, HOUR);
		toUnit.randomizationType = "unit";
		await refreshTo(context, toUnit);
		await refreshTo(context, sb(2, HOUR));
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(2);

		await refreshTo(context);
		await refreshTo(context, sb(2, HOUR));
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(3);

		const regridded = sb(2, HOUR);
		regridded.switchbackDesignType = "other";
		await refreshTo(context, regridded);
		await refreshTo(context, sb(2, HOUR));
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect(context.pending()).toEqual(4);

		// An unchanged identity keeps the epoch.
		await refreshTo(context, sb(2, HOUR));
		context.treatment("exp_sb");
		expect(context.pending()).toEqual(4);
	});

	// A legacy switchback serves under its declared unitType, so a unitType change is identity for it.
	it("treats a unitType change on the legacy path as identity", async () => {
		const legacy = sb(2, HOUR);
		legacy.switchbackClusters = null;
		const logger = jest.fn();
		const context = createContext(dataOf(legacy), { [UNIT_TYPE]: UID, user_id: "u1" }, logger);
		clock = ANCHOR + 10;
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.variableValue("sb.arm", -1)).toEqual(0);

		await refreshTo(context, { ...legacy, unitType: "other" });
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.variableValue("sb.arm", -1)).toEqual(-1);

		await refreshTo(context, { ...legacy, unitType: "user_id" });
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.variableValue("sb.arm", -1)).toEqual(0);
		// An override shows which unit the legacy control is recorded under.
		context.override("exp_sb", 1);
		expect(context.treatment("exp_sb")).toEqual(1);
		expect(await publishExposures(context)).toEqual([
			{ ...exposure(1, "exp_sb", 1, ANCHOR + 10, false, true, { overridden: true }), unit: "user_id" },
		]);
	});

	// An ineligible or absent switchback slot never consulted its rules, so neither a set attribute nor
	// a rules refresh re-evaluates them or changes its result.
	it("does not re-evaluate rules for an ineligible or absent slot", async () => {
		const ineligible = switchback(1, "exp_ineligible", 2, HOUR);
		ineligible.assignmentRules = ASSIGN_VARIANT_1;
		ineligible.switchbackClusterValues = ["other-store"];
		const absent = switchback(2, "exp_absent", 2, HOUR);
		absent.assignmentRules = ASSIGN_VARIANT_1;
		absent.switchbackClusters = { device_id: CLUSTER_PATH };
		const context = createContext(dataOf(ineligible, absent));
		const evaluate = jest.spyOn(context._audienceMatcher, "evaluateParsedRules");
		clock = ANCHOR + 10;
		expect(context.treatment("exp_ineligible")).toEqual(0);
		expect(context.treatment("exp_absent")).toEqual(0);
		expect(evaluate).not.toHaveBeenCalled();

		context.attribute("x", 1);
		const changedRules = '{"rules":[{"type":"assign","environments":[],"variant":1,"name":"changed"}]}';
		await refreshTo(
			context,
			{ ...ineligible, assignmentRules: changedRules },
			{ ...absent, assignmentRules: changedRules }
		);

		expect(context.treatment("exp_ineligible")).toEqual(0);
		expect(context.treatment("exp_absent")).toEqual(0);
		expect(evaluate).not.toHaveBeenCalled();
		expect(context.pending()).toEqual(0);
	});

	// A rule-won switchback re-resolved in the same period keeps its variant and is exposed once.
	it("keeps the variant and exposes once after an in-period rule refresh", async () => {
		const experiment = sb(2, HOUR);
		experiment.assignmentRules = ASSIGN_VARIANT_1;
		const context = createContext(dataOf(experiment));
		clock = ANCHOR + 5;
		expect(context.treatment("exp_sb")).toEqual(1);

		context.attribute("tier", "x");
		const refreshed = sb(2, HOUR);
		refreshed.assignmentRules =
			'{"rules":[{"type":"assign","environments":[],"variant":1,"conditions":{"and":[{"eq":[{"var":"tier"},{"value":"x"}]}]}}]}';
		await refreshTo(context, refreshed);
		clock = ANCHOR + 6;
		expect(context.treatment("exp_sb")).toEqual(1);
		expect(await publishExposures(context)).toEqual([ruleExposure("exp_sb", 1, ANCHOR + 5)]);
	});

	// A same-outcome revalidation advances the slot's stamps, so later reads do not evaluate again.
	it("evaluates rules and audience once per change on a cached slot", () => {
		const experiment = sb(2, HOUR);
		experiment.assignmentRules =
			'{"rules":[{"type":"assign","environments":[],"variant":1,"conditions":{"and":[{"eq":[{"var":"country"},{"value":"US"}]}]}}]}';
		experiment.audience = '{"filter":[{"eq":[{"var":"tier"},{"value":"gold"}]}]}';
		const context = createContext(dataOf(experiment));
		const rules = jest.spyOn(context._audienceMatcher, "evaluateParsedRules");
		const audience = jest.spyOn(context._audienceMatcher, "evaluate");
		clock = ANCHOR + 5;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_2_ARMS[0]);
		expect([rules.mock.calls.length, audience.mock.calls.length]).toEqual([1, 1]);

		for (let i = 0; i < 3; ++i) context.peek("exp_sb");
		expect([rules.mock.calls.length, audience.mock.calls.length]).toEqual([1, 1]);

		context.attribute("unrelated", 1);
		for (let i = 0; i < 3; ++i) context.peek("exp_sb");
		expect([rules.mock.calls.length, audience.mock.calls.length]).toEqual([2, 2]);

		context.attribute("country", "US");
		expect(context.treatment("exp_sb")).toEqual(1);
		expect(context.pending()).toEqual(2);
		for (let i = 0; i < 3; ++i) context.peek("exp_sb");
		expect(rules.mock.calls.length).toEqual(4);
	});

	// Before the anchor nothing is recorded, a traffic miss included, because the period check precedes
	// traffic. From the anchor the same miss is recorded.
	it("is silent for a pre-anchor traffic miss", async () => {
		const experiment = sb(2, HOUR);
		experiment.trafficSplit = [1, 0];
		clock = ANCHOR - 1;
		const context = createContext(dataOf(experiment));
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(context.pending()).toEqual(0);

		clock = ANCHOR;
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(await publishExposures(context)).toEqual([exposure(1, "exp_sb", 0, ANCHOR, true, false)]);
	});

	// An override on a switchback with no serving unit is exposed under the declared unitType when the
	// cluster map is missing or unreadable, and under the first declared type of a readable map.
	it("exposes an override without a serving unit under the legacy or first linked unit type", async () => {
		const missing = switchback(1, "exp_missing_map", 2, HOUR);
		missing.unitType = "user_id";
		missing.switchbackClusters = null;
		const unreadable = switchback(2, "exp_unreadable_map", 2, HOUR);
		unreadable.unitType = "user_id";
		unreadable.switchbackClusters = { [UNIT_TYPE]: "'unterminated" };
		const noUnit = switchback(3, "exp_no_unit", 2, HOUR);
		noUnit.unitType = "user_id";
		noUnit.switchbackClusters = { device_id: "x", [UNIT_TYPE]: "y" };
		const context = createContext(dataOf(missing, unreadable, noUnit), { user_id: "u1" });
		context.override("exp_missing_map", 1);
		context.override("exp_unreadable_map", 1);
		context.override("exp_no_unit", 1);
		clock = ANCHOR + 5;
		expect(context.treatment("exp_missing_map")).toEqual(1);
		expect(context.treatment("exp_unreadable_map")).toEqual(1);
		expect(context.treatment("exp_no_unit")).toEqual(1);

		expect(await publishExposures(context)).toEqual([
			{ ...exposure(1, "exp_missing_map", 1, ANCHOR + 5, false, true, { overridden: true }), unit: "user_id" },
			{ ...exposure(2, "exp_unreadable_map", 1, ANCHOR + 5, false, true, { overridden: true }), unit: "user_id" },
			{ ...exposure(3, "exp_no_unit", 1, ANCHOR + 5, false, true, { overridden: true }), unit: "device_id" },
		]);
	});

	// An overridden switchback exposed with no linked unit is not resolved again when one is set, so
	// the override is not exposed twice; an unexposed one is.
	it("keeps an exposed override without a linked unit when a unit is set", async () => {
		const context = createContext(dataOf(sb(2, HOUR), switchback(2, "exp_peeked", 2, HOUR)), {});
		context.override("exp_sb", 1);
		context.override("exp_peeked", 1);
		expect(context.treatment("exp_sb")).toEqual(1);
		expect(context.peek("exp_peeked")).toEqual(1);
		context.unit(UNIT_TYPE, UID);
		expect(context.treatment("exp_sb")).toEqual(1);
		expect(context.treatment("exp_peeked")).toEqual(1);
		const exposures = await publishExposures(context);
		expect(exposures.map((e) => [e.name, e.unit])).toEqual([
			["exp_sb", UNIT_TYPE],
			["exp_peeked", UNIT_TYPE],
		]);
	});

	// A slot read while no linked unit was set is read again when it is rebuilt: an exposed override kept
	// across setUnit, then changed, is recorded under the unit that now serves.
	it("reads the cluster again for a slot resolved without a linked unit", async () => {
		const experiment = sb(2, HOUR);
		experiment.switchbackClusters = { device_id: "device_key", [UNIT_TYPE]: CLUSTER_PATH };
		const context = createContext(dataOf(experiment), {});
		context.override("exp_sb", 1);
		expect(context.treatment("exp_sb")).toEqual(1);
		context.unit(UNIT_TYPE, UID);
		expect(context.treatment("exp_sb")).toEqual(1);
		context.override("exp_sb", 0);
		expect(context.treatment("exp_sb")).toEqual(0);
		expect((await publishExposures(context)).map((e) => [e.variant, e.unit])).toEqual([
			[1, "device_id"],
			[0, UNIT_TYPE],
		]);
	});

	it("publishes rule-won and traffic-miss exposures exactly", async () => {
		const rule = switchback(1, "exp_rule", 2, HOUR);
		rule.assignmentRules = ASSIGN_VARIANT_1;
		const miss = switchback(2, "exp_miss", 2, HOUR);
		miss.trafficSplit = [1, 0];
		const context = createContext(dataOf(rule, miss));
		clock = ANCHOR + 5;
		context.treatment("exp_rule");
		context.treatment("exp_miss");
		clock = ANCHOR + 9;

		const [request] = await publishRequests(context);
		expect(JSON.stringify(request)).toEqual(
			JSON.stringify({
				publishedAt: ANCHOR + 9,
				units: [{ type: UNIT_TYPE, uid: UID_HASH }],
				hashed: true,
				sdkVersion: SDK_VERSION,
				exposures: [
					ruleExposure("exp_rule", 1, ANCHOR + 5),
					exposure(2, "exp_miss", 0, ANCHOR + 5, true, false),
				],
				attributes: [{ name: CLUSTER_PATH, value: CLUSTER_KEY, setAt: ANCHOR }],
			})
		);
	});

	// Traffic comes before the custom assignment: a traffic miss wins over it and is recorded, custom=false.
	it("lets a traffic miss win over a custom assignment", async () => {
		const miss = sb(3, HOUR);
		miss.trafficSplit = [1, 0];
		const context = createContext(dataOf(miss));
		context.customAssignment("exp_sb", 2);
		clock = ANCHOR + 2 * HOUR;
		expect(context.treatment("exp_sb")).toEqual(0);
		expect(await publishExposures(context)).toEqual([exposure(1, "exp_sb", 0, ANCHOR + 2 * HOUR, true, false)]);
	});

	// A custom assignment set or changed later re-resolves the slot, as for a unit experiment.
	it("re-resolves a slot when the custom assignment changes", async () => {
		const context = createContext(dataOf(sb(3, HOUR)));
		clock = ANCHOR + 2 * HOUR;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_3_ARMS[2]);
		context.customAssignment("exp_sb", 2);
		expect(context.treatment("exp_sb")).toEqual(2);
		context.customAssignment("exp_sb", 2);
		expect(context.treatment("exp_sb")).toEqual(2);
		expect(context.pending()).toEqual(2);
	});

	it("re-resolves a slot when full-on or traffic changes on refresh", async () => {
		const context = createContext(dataOf(sb(3, HOUR)));
		clock = ANCHOR + 2 * HOUR;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_3_ARMS[2]);
		await refreshTo(context, { ...sb(3, HOUR), fullOnVariant: 2 });
		expect(context.treatment("exp_sb")).toEqual(2);
		await refreshTo(context, { ...sb(3, HOUR), fullOnVariant: 2, trafficSplit: [1, 0] });
		expect(context.treatment("exp_sb")).toEqual(2);
		await refreshTo(context, { ...sb(3, HOUR), trafficSplit: [1, 0] });
		expect(context.treatment("exp_sb")).toEqual(0);
		// Each change re-resolves and exposes once, as for a unit experiment.
		expect(context.pending()).toEqual(4);
	});

	// The serving unit and cluster key are read once per period slot: a later setAttribute does not
	// move the unit to another cluster, even when an audience change rebuilds the slot.
	it("reads the cluster once per period slot", async () => {
		const experiment = sb(3, HOUR);
		experiment.audience = '{"filter":[{"eq":[{"var":"tier"},{"value":"gold"}]}]}';
		const context = createContext(dataOf(experiment));
		clock = ANCHOR + 2 * HOUR;
		const first = context.treatment("exp_sb");
		expect(first).toEqual(EXPECTED_3_ARMS[2]);

		context.attribute(CLUSTER_PATH, "store-7");
		expect(context.treatment("exp_sb")).toEqual(first);
		// The audience now matches, so the slot is rebuilt and exposed again, under the same cluster.
		context.attribute("tier", "gold");
		expect(context.treatment("exp_sb")).toEqual(first);
		expect(context.pending()).toEqual(2);

		// The next period reads the attributes again.
		clock = ANCHOR + 3 * HOUR;
		expect(context.treatment("exp_sb")).toEqual(draw("store-7", 3, seedOf(SEED_HI, SEED_LO), 3));
	});

	// Only attributes set at or before the resolving reading are seen; the latest setAt wins and a tie
	// goes to the one set last. System attributes are not visible to cluster paths.
	it("reads the attribute the Collector reads at the resolution instant", () => {
		// Ten arms and values whose period-2 draws all differ (v8 -> 0, v28 -> 1, v0 -> 2, v2 -> 3, v1 -> 4),
		// so every wrong pick serves a different arm.
		const experiment = sb(10, HOUR);
		const systemOnly = switchback(2, "exp_system", 3, HOUR);
		systemOnly.switchbackClusters = { [UNIT_TYPE]: "application" };
		clock = ANCHOR + 2 * HOUR - 10;
		const context = createContext(dataOf(experiment, systemOnly));
		context.attribute(CLUSTER_PATH, "v8");
		clock = ANCHOR + 2 * HOUR - 5;
		// Names are compared trimmed; the latest setAt wins and a tie goes to the one set last.
		context.attribute(` ${CLUSTER_PATH} `, "v28");
		context.attribute(CLUSTER_PATH, "v0");
		clock = ANCHOR + 2 * HOUR + 5;
		// Set after the resolving reading below: not seen.
		context.attribute(CLUSTER_PATH, "v2");
		clock = ANCHOR + 2 * HOUR;
		const expected = draw("v0", 2, seedOf(SEED_HI, SEED_LO), 10);
		expect(expected).toEqual(2);
		expect(context.peek("exp_sb")).toEqual(expected);
		// System attributes are not visible to cluster paths.
		expect(context.treatment("exp_system")).toEqual(0);
		expect(context.pending()).toEqual(0);
	});

	it("reads a trimmed attribute name like the Collector", () => {
		clock = ANCHOR + 2 * HOUR;
		const context = createContext(dataOf(sb(10, HOUR)));
		context.attribute(` ${CLUSTER_PATH}\t`, "v1");
		expect(context.peek("exp_sb")).toEqual(draw("v1", 2, seedOf(SEED_HI, SEED_LO), 10));
		expect(context.peek("exp_sb")).toEqual(4);
	});

	it("tolerates unknown and future switchback fields", () => {
		const experiment = {
			...sb(3, HOUR),
			switchbackClusterUnitType: UNIT_TYPE,
			switchbackClusterCount: 10,
			switchbackClusterAttribute: CLUSTER_PATH,
			switchbackFuture: { nested: [1, { a: null }] },
			switchbackCarryoverDurationMs: "not a number",
			switchbackEstimand: { unexpected: true },
		};
		const phase1e = {
			...sb(3, HOUR),
			id: 2,
			name: "exp_phase1e",
			switchbackClusters: undefined,
			switchbackClusterCount: 4,
		};
		const context = createContext(dataOf(experiment, phase1e, asUnit(switchback(3, "exp_unit", 2, HOUR))));
		clock = ANCHOR + 2 * HOUR;
		expect(context.treatment("exp_sb")).toEqual(EXPECTED_3_ARMS[2]);
		expect(context.treatment("exp_phase1e")).toEqual(0);
		expect(context.treatment("exp_unit")).toEqual(expect.any(Number));
		expect(context.pending()).toEqual(2);
	});

	it("keeps the declared cluster order of a parsed payload", () => {
		const json = `{"experiments":[${JSON.stringify(sb(3, HOUR)).replace(
			`"switchbackClusters":{"${UNIT_TYPE}":"${CLUSTER_PATH}"}`,
			`"switchbackClusters":{"user_id":"profile/city","device_id":"device/city","${UNIT_TYPE}":"store_city"}`
		)}]}`;
		const data = JSON.parse(json);
		expect(Object.keys(data.experiments[0].switchbackClusters)).toEqual(["user_id", "device_id", UNIT_TYPE]);
		const context = createContext(data, { device_id: "d1", [UNIT_TYPE]: UID, user_id: "u1" });
		context.attributes({ profile: { city: "many-3" }, device: { city: "many-3" }, store_city: "many-3" });
		context.override("exp_sb", 1);
		context.treatment("exp_sb");
		expect(context._exposures.map((e) => e.unit)).toEqual(["user_id"]);
	});
});
