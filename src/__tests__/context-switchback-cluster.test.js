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

// Port of java-sdk's ContextSwitchbackClusterRuleTest, itself a port of the Collector's
// ContextAPISwitchbackTest ClusterRule section (absmartly/abs 9bd2b5ca35), through the public Context
// API. Switchback "sbc" (id 900, "34/33/33", 1h) is linked to user_id (unit type id 2) at
// "profile/store" and to session_id (unit type id 1) at "session_store", declared in unit type id
// order, so session_id comes first although the user_id link was inserted first.
//
// A context holds one uid per unit type and keeps its units in an object, so the declared source
// order alone decides which unit serves.
const HOUR = 3600000;
const ANCHOR = 1767225600000;
const PERIOD = 5;
const NOW = ANCHOR + PERIOD * HOUR + 17 * 60000;
const SEED_HI = 0x1234;
const SEED_LO = 0x5678abcd;
const TRAFFIC_SEED_HI = 7;
const TRAFFIC_SEED_LO = 11;

const SESSION = "session_id";
const USER = "user_id";

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
let experiment;
let links;

function switchbackExperiment(experimentName, id, unitType, split) {
	const parts = split.split("/");
	return {
		id,
		name: experimentName,
		unitType,
		iteration: 1,
		seedHi: SEED_HI,
		seedLo: SEED_LO,
		split: parts.map((p) => Number(p) / 100),
		trafficSeedHi: TRAFFIC_SEED_HI,
		trafficSeedLo: TRAFFIC_SEED_LO,
		trafficSplit: [0, 1],
		fullOnVariant: 0,
		applications: [{ name: "website" }],
		variants: parts.map((p, i) => ({ name: String(i), config: `{"sbc.config":"test config ${i}"}` })),
		audience: null,
		audienceStrict: false,
		customFieldValues: null,
		randomizationType: "switchback",
		switchbackStartAt: ANCHOR,
		switchbackPeriodMs: HOUR,
		switchbackDesignType: "balanced_block",
	};
}

function unitExperiment(experimentName, id, unitType) {
	const unit = switchbackExperiment(experimentName, id, unitType, "50/50");
	delete unit.randomizationType;
	delete unit.switchbackStartAt;
	delete unit.switchbackPeriodMs;
	delete unit.switchbackDesignType;
	unit.variants = [
		{ name: "0", config: null },
		{ name: "1", config: null },
	];
	return unit;
}

// switchbackClusters in declared (unit type id ascending) order: session_id (1) before user_id (2).
function refreshLinks() {
	const clusters = {};
	for (const type of [SESSION, USER, "device_id"]) {
		for (const [linkType, path] of links) {
			if (linkType === type) clusters[linkType] = path;
		}
	}
	experiment.switchbackClusters = links.length === 0 ? null : clusters;
}

function unlinkAll() {
	links = [];
	refreshLinks();
}

function link(unitType, path) {
	links.push([unitType, path]);
	refreshLinks();
}

beforeEach(() => {
	clock = NOW;
	jest.spyOn(Date, "now").mockImplementation(() => clock);
	publisher.publish.mockReset();
	publisher.publish.mockReturnValue(Promise.resolve());
	experiment = switchbackExperiment("sbc", 900, USER, "34/33/33");
	unlinkAll();
	link(USER, "profile/store");
	link(SESSION, "session_store");
});

function scheduled(clusterKey) {
	return assignSwitchbackPeriod(clusterKey, PERIOD, SEED_HI, SEED_LO, 3);
}

let exposures;

function createContext(attributes, experiments, units) {
	exposures = [];
	const eventLogger = (context, eventName, data) => {
		if (eventName === "exposure") exposures.push(data);
	};
	const context = new Context(sdk, { publishDelay: -1, refreshPeriod: 0, eventLogger }, { units }, { experiments });
	if (attributes != null) context.attributes(attributes);
	return context;
}

// The cached "sbc" resolution at the clock's current reading (Java's switchbackResolutionForTest).
function resolution(context) {
	const periods = Object.values(context._switchbackEpochs?.sbc?.slots ?? {});
	const slots = "sbc" in context._assignments ? [context._assignments.sbc, ...periods] : periods;
	expect(slots.length).toEqual(1);
	return slots[0];
}

// The Collector's ExperimentAssignment for "sbc", or null when it lists none (not applicable). Every
// other experiment is resolved (and exposed) first, so the caches it fills are in place.
function sbcWith(attributes, experiments, units) {
	const context = createContext(attributes, experiments, units);
	for (const other of experiments) {
		if (other.name !== "sbc") context.treatment(other.name);
	}
	const variant = context.treatment("sbc");
	const resolved = resolution(context);
	const config = context.variableValue("sbc.config", null);
	const sbcExposures = exposures.filter((e) => e.name === "sbc");
	// Keyed on the serving status, not on assigned: a strict audience mismatch is not assigned yet is
	// still an assignment the Collector lists.
	if (resolved.switchbackServing.status === 0) {
		expect(variant).toEqual(0);
		expect(config).toBeNull();
		expect(sbcExposures).toEqual([]);
		return null;
	}
	return {
		unit: resolved.unitType,
		eligible: resolved.eligible,
		silent: resolved.switchbackSilent === true,
		variant,
		fullOn: resolved.fullOn,
		ruleOverride: resolved.ruleOverride,
		config,
		exposures: sbcExposures,
	};
}

function sbc(attributes, units) {
	return sbcWith(attributes, [experiment], units);
}

// An ineligible cluster resolution is still an assignment, as control, under the first linked-type
// unit in declared order, and no exposure is recorded for it.
function expectIneligible(attributes, expectedUnit, units) {
	const assignment = sbc(attributes, units);
	expect(assignment).not.toBeNull();
	expect(assignment).toEqual({
		unit: expectedUnit,
		eligible: false,
		silent: true,
		variant: 0,
		fullOn: false,
		ruleOverride: false,
		config: "test config 0",
		exposures: [],
	});
}

const store = (value) => ({ store: value });

describe("switchback cluster rule", () => {
	it("returns only a legacy ineligible control for a missing or unreadable cluster configuration", () => {
		for (const broken of [
			"null-cluster",
			"missing-links",
			"unreadable-path",
			"geo.city",
			"'geo.city'",
			'"geo.city"',
			"unknown-unit",
		]) {
			unlinkAll();
			if (broken === "unreadable-path") {
				link(SESSION, "'geo");
			} else if (broken === "unknown-unit") {
				// A readable map whose only linked type (device_id) is absent from the context.
				link("device_id", "session_store");
				expect([broken, sbc({ session_store: "s-1" }, { [SESSION]: "x1", [USER]: "u1" })]).toEqual([
					broken,
					null,
				]);
				continue;
			} else if (broken === "missing-links") {
				experiment.switchbackClusters = {};
			} else if (broken !== "null-cluster") {
				link(SESSION, broken);
			}
			const attributes = { geo: { city: "Porto" }, "geo.city": "Faro", session_store: "s-1" };
			// The declared unit (user_id) only identifies an ineligible control response.
			expectIneligible(attributes, USER, { [SESSION]: "x1", [USER]: "u1" });
			// Without a unit of the declared type, there is no response at all.
			expect([broken, sbc(attributes, { [SESSION]: "x1" })]).toEqual([broken, null]);
		}
	});

	it("uses the serving uid for traffic, not the experiment's unit type uid", () => {
		// percentageOfTraffic = 40.
		experiment.trafficSplit = [0.6, 0.4];
		const ordinary = unitExperiment("ordinary", 901, USER);
		const witnesses = [null, null];
		for (let i = 0; i < 1000 && (witnesses[0] === null || witnesses[1] === null); ++i) {
			const uid = `traffic-${i}`;
			witnesses[
				new VariantAssigner(hashUnit(uid)).assign([0.6, 0.4], TRAFFIC_SEED_HI, TRAFFIC_SEED_LO) === 0 ? 0 : 1
			] = uid;
		}
		expect(witnesses).not.toContain(null);
		const key = "s-18";
		// The eligible draw must be distinguishable from control.
		expect(scheduled(key)).not.toEqual(0);
		for (const servingEligible of [false, true]) {
			const assignment = sbcWith({ session_store: key, profile: store(key) }, [experiment, ordinary], {
				[SESSION]: witnesses[servingEligible ? 1 : 0],
				[USER]: witnesses[servingEligible ? 0 : 1],
			});
			expect(assignment.unit).toEqual(SESSION);
			expect(assignment.eligible).toEqual(servingEligible);
			expect(assignment.variant).toEqual(servingEligible ? scheduled(key) : 0);
			// A traffic miss on an eligible cluster is still recorded, under the serving unit.
			expect(assignment.exposures.map((e) => [e.unit, e.eligible])).toEqual([[SESSION, servingEligible]]);
		}
	});

	it("serves the value of one matching unit", () => {
		const assignment = sbc({ profile: store("s-17") }, { [USER]: "u1" });

		expect(assignment.eligible).toBe(true);
		expect(assignment.unit).toEqual(USER);
		expect(assignment.variant).toEqual(scheduled("s-17"));
	});

	// A strict audience mismatch on an eligible cluster is not assigned, yet still listed, as control
	// under the serving unit, and its exposure is published.
	it("lists and records a strict audience mismatch on an eligible cluster as control", () => {
		experiment.audience = '{"filter":[{"eq":[{"var":"tier"},{"value":"gold"}]}]}';
		experiment.audienceStrict = true;
		const assignment = sbc({ session_store: "s-17" }, { [SESSION]: "x1" });

		expect(assignment).not.toBeNull();
		expect(assignment.unit).toEqual(SESSION);
		expect(assignment.eligible).toBe(true);
		expect(assignment.silent).toBe(false);
		expect(assignment.variant).toEqual(0);
		expect(assignment.exposures.length).toEqual(1);
		expect(assignment.exposures[0].audienceMismatch).toBe(true);
		expect(assignment.exposures[0].assigned).toBe(false);
	});

	it("serves the value two agreeing units give", () => {
		const assignment = sbc({ profile: store("s-17"), session_store: "s-17" }, { [USER]: "u1", [SESSION]: "x1" });

		expect(assignment.eligible).toBe(true);
		expect(assignment.variant).toEqual(scheduled("s-17"));
	});

	it("is ineligible when two units disagree", () => {
		// session_id (type id 1) is first in declared order whatever the context order.
		expectIneligible({ profile: store("s-17"), session_store: "s-18" }, SESSION, { [USER]: "u1", [SESSION]: "x1" });
	});

	// A context holds one uid per unit type, so a second session_id is rejected.
	it("serves one unit per type", () => {
		const key = "s-17";
		expect(scheduled(key)).not.toEqual(0);
		const context = createContext({ session_store: key }, [experiment], { [SESSION]: "x1" });
		expect(() => context.unit(SESSION, "x2")).toThrow("Unit 'session_id' UID already set.");

		const assignment = sbc({ session_store: key }, { [SESSION]: "x1" });
		expect(assignment.eligible).toBe(true);
		expect(assignment.variant).toEqual(scheduled(key));
	});

	it("does not apply without a unit of a linked type", () => {
		expect(sbc({ session_store: "s-1" }, { device_id: "d1" })).toBeNull();
		expect(sbc({ session_store: "s-1" }, {})).toBeNull();
	});

	it("is ineligible when the matching unit has no value", () => {
		expectIneligible({ other: "s-1" }, USER, { [USER]: "u1" });
		expectIneligible({ other: "s-1" }, SESSION, { [USER]: "u1", [SESSION]: "x1" });
	});

	it("is ineligible for values that are neither non-empty strings nor whole numbers", () => {
		// 3.0 is the integer 3 in JS, so it is not in this list (see "keys whole numbers").
		for (const value of [1.5, -0.25, true, false, { a: 1 }, ["a"], [], "", null, 1e21, NaN, Infinity]) {
			expectIneligible({ session_store: value }, SESSION, { [SESSION]: "x1" });
		}
	});

	it("keys whole numbers by their decimal text", () => {
		expect(scheduled("17")).not.toEqual(0);
		const assignment = sbc({ session_store: 17 }, { [SESSION]: "x1" });

		expect(assignment.eligible).toBe(true);
		expect(assignment.variant).toEqual(scheduled("17"));
		// Equal to the string "17" from another unit type, so the two agree.
		expect(sbc({ session_store: 17, profile: store("17") }, { [SESSION]: "x1", [USER]: "u1" }).eligible).toBe(true);
		// JS cannot tell 3.0 from 3, so 17.0 keys like 17 (documented limitation).
		expect(sbc({ session_store: 17.0 }, { [SESSION]: "x1" }).variant).toEqual(scheduled("17"));
		// Beyond int32 and 2^53 the decimal text is kept exactly as published.
		expect(sbc({ session_store: 4000000002 }, { [SESSION]: "x1" }).variant).toEqual(scheduled("4000000002"));
		expect(sbc({ session_store: -3 }, { [SESSION]: "x1" }).variant).toEqual(scheduled("-3"));
	});

	it("reads nested and array paths", () => {
		unlinkAll();
		link(SESSION, "items/1/store");

		const assignment = sbc({ items: [store("a"), store("b")] }, { [SESSION]: "x1" });
		expect(assignment.variant).toEqual(scheduled("b"));
		expect(scheduled("a")).not.toEqual(scheduled("b"));
	});

	it("exposes under the first matching unit in declared order whatever the context order", () => {
		const key = "s-18";
		expect(scheduled(key)).not.toEqual(0);
		const assignment = sbc({ profile: store(key), session_store: key }, { [USER]: "u1", [SESSION]: "x1" });

		expect(assignment.unit).toEqual(SESSION);
		expect(assignment.exposures[0].unit).toEqual(SESSION);
		expect(assignment.variant).toEqual(scheduled(key));
	});

	it("never publishes an exposure for an ineligible cluster", async () => {
		const context = createContext({ session_store: "a", profile: store("b") }, [experiment], {
			[USER]: "u1",
			[SESSION]: "x1",
		});
		expect(context.treatment("sbc")).toEqual(0);
		expect(context.pending()).toEqual(0);
		await context.publish();
		expect(publisher.publish).not.toHaveBeenCalled();
		expect(exposures).toEqual([]);
	});

	it("does not serve a unit without a value even if it is first in declared order", () => {
		const key = "s-17";
		expect(scheduled(key)).not.toEqual(0);
		const assignment = sbc({ profile: store(key) }, { [SESSION]: "x1", [USER]: "u1" });

		expect(assignment.unit).toEqual(USER);
		expect(assignment.exposures[0].unit).toEqual(USER);
		expect(assignment.variant).toEqual(scheduled(key));
	});

	it("is ineligible for a value outside the allow-list", () => {
		experiment.switchbackClusterValues = ["s-1", "s-2"];

		expectIneligible({ session_store: "s-3" }, SESSION, { [SESSION]: "x1" });
		const allowed = sbc({ session_store: "s-2" }, { [SESSION]: "x1" });
		expect(allowed.eligible).toBe(true);
		expect(allowed.variant).toEqual(scheduled("s-2"));
	});

	it("assigns every value with a null or empty allow-list", () => {
		for (const values of [null, undefined, []]) {
			experiment.switchbackClusterValues = values;
			for (let i = 0; i < 20; ++i) {
				const assignment = sbc({ session_store: `s-${i}` }, { [SESSION]: "x1" });
				expect(assignment.eligible).toBe(true);
				expect(assignment.variant).toEqual(scheduled(`s-${i}`));
			}
		}
	});

	// A valid cluster map whose linked types are all absent from the context does not fall back to the
	// experiment's declared unitType: no assignment, no exposure.
	it("does not fall back to the experiment unit without a linked unit", () => {
		unlinkAll();
		link(SESSION, "session_store");
		const key = "s-17";
		expect(scheduled(key)).not.toEqual(0);

		expect(sbc({ session_store: key, profile: store(key) }, { [USER]: "u1" })).toBeNull();
		const linked = sbc({ session_store: key }, { [USER]: "u1", [SESSION]: "x1" });
		expect(linked.unit).toEqual(SESSION);
		expect(linked.variant).toEqual(scheduled(key));
	});

	// The Collector's wire-rule oracle SdkSwitchbackRule, transcribed: period index from the anchor
	// re-ceiled to the hour, traffic on the serving uid's hash, then the schedule draw over the cluster
	// key. A null cluster key has no draw. It shares the assigners with the SDK, whose parity is pinned
	// by the golden vectors, so it is a wire-rule parity check, not an independent oracle.
	const NO_PERIOD = null;
	function oraclePeriodIndex(e, now) {
		if (e.switchbackStartAt == null || e.switchbackPeriodMs == null || e.switchbackPeriodMs <= 0) return NO_PERIOD;
		if (e.split == null || e.split.length < 2) return NO_PERIOD;
		const anchor = Math.ceil(e.switchbackStartAt / HOUR) * HOUR;
		if (now < anchor) return NO_PERIOD;
		return Math.floor((now - anchor) / e.switchbackPeriodMs);
	}
	function oracle(e, uid, clusterKey, now) {
		const periodIndex = oraclePeriodIndex(e, now);
		if (clusterKey == null || periodIndex === NO_PERIOD) return [0, false];
		const eligible =
			new VariantAssigner(hashUnit(uid)).assign(e.trafficSplit, e.trafficSeedHi, e.trafficSeedLo) === 1;
		if (!eligible) return [0, false];
		return [assignSwitchbackPeriod(clusterKey, periodIndex, e.seedHi, e.seedLo, e.split.length), true];
	}

	function gridContext(cluster, uid, key) {
		unlinkAll();
		link(SESSION, "session_store");
		experiment.switchbackClusterValues = null;
		switch (cluster) {
			case "DISAGREEING_SECOND_SOURCE":
				link(USER, "profile/store");
				return createContext({ session_store: key, profile: store(`${key}-other`) }, [experiment], {
					[SESSION]: uid,
					[USER]: `u-${uid}`,
				});
			case "MISSING_VALUE":
				return createContext({ other: key }, [experiment], { [SESSION]: uid });
			case "FILTERED_VALUE":
				experiment.switchbackClusterValues = [`${key}-allowed`];
				return createContext({ session_store: key }, [experiment], { [SESSION]: uid });
			default:
				return createContext({ session_store: key }, [experiment], { [SESSION]: uid });
		}
	}

	it("matches the Collector's wire-rule parity grid", () => {
		let eligible = 0;
		let ineligible = 0;
		let trafficMisses = 0;
		for (const cluster of ["SINGLE", "DISAGREEING_SECOND_SOURCE", "MISSING_VALUE", "FILTERED_VALUE"]) {
			for (const anchor of [ANCHOR, ANCHOR + 7 * HOUR]) {
				for (const periodMs of [HOUR, 2 * HOUR, 24 * HOUR]) {
					experiment.trafficSplit = [0.3, 0.7];
					experiment.switchbackStartAt = anchor;
					experiment.switchbackPeriodMs = periodMs;
					for (let u = 0; u < 6; ++u) {
						const uid = `uid-${u}`;
						for (const key of ["s-1", "s-2", "42", "Lisboa"]) {
							for (const now of [
								anchor - HOUR,
								anchor - 1,
								anchor,
								anchor + periodMs - 1,
								anchor + periodMs,
								anchor + 3 * periodMs + 5,
								anchor + 11 * periodMs,
							]) {
								// The attributes are set before the resolving reading.
								clock = anchor - HOUR;
								const context = gridContext(cluster, uid, key);
								clock = now;
								const oracleKey = cluster === "SINGLE" ? key : null;
								const [oracleVariant, oracleEligible] = oracle(experiment, uid, oracleKey, now);
								const message = `${cluster}/${anchor}/${periodMs}/${uid}/${key}/${now}`;
								expect([message, context.treatment("sbc")]).toEqual([message, oracleVariant]);
								expect([message, resolution(context).eligible]).toEqual([message, oracleEligible]);
								// Before the anchor nothing is recorded; from it, a keyed cluster records one
								// exposure whose eligibility is the oracle's (a traffic miss included).
								const expectedExposures = oracleKey !== null && now >= anchor ? 1 : 0;
								expect([message, exposures.length]).toEqual([message, expectedExposures]);
								if (expectedExposures === 1) {
									expect([message, exposures[0].eligible]).toEqual([message, oracleEligible]);
								}
								if (cluster === "SINGLE") {
									if (oracleEligible) {
										++eligible;
									} else {
										++ineligible;
										if (now >= anchor) ++trafficMisses;
									}
								}
							}
						}
					}
				}
			}
		}
		expect(eligible).toBeGreaterThan(100);
		expect(ineligible).toBeGreaterThan(100);
		// Pre-anchor cases alone meet the guard above; this one needs the recorded traffic-miss branch.
		expect(trafficMisses).toBeGreaterThan(0);

		// The deliberate divergence: an anchor off the hour is unservable in the SDK (as in the Collector's
		// Registry), while the transcribed oracle would re-ceil it and draw.
		const unaligned = ANCHOR + 7 * HOUR + 1;
		experiment.trafficSplit = [0, 1];
		experiment.switchbackStartAt = unaligned;
		experiment.switchbackPeriodMs = HOUR;
		clock = ANCHOR + 8 * HOUR + 5;
		expect(oraclePeriodIndex(experiment, clock)).not.toBeNull();
		expect(oracle(experiment, "uid-0", "s-1", clock)[1]).toBe(true);
		const context = gridContext("SINGLE", "uid-0", "s-1");
		expect(context.treatment("sbc")).toEqual(0);
		expect(resolution(context).eligible).toBe(false);
		expect(exposures).toEqual([]);
	});
});
