import { murmur3_32 } from "./murmur3_32";
import { stringToUint8Array, toWellFormedString } from "./utils";

// Switchback experiments (R33, cluster-defined): a port of java-sdk's internal Switchback* classes,
// which port the platform's SwitchbackAssignment and the Collector's ContextAPI.switchbackServing.
// See the README section "Switchback experiments" for the serving rules. The full signed 64-bit
// assigner, which Context does not need, is in switchback-long.ts so the browser bundle leaves it out.

const NORMALIZER = 1.0 / 0xffffffff;

export function requireValidArmCount(armCount: number) {
	if (typeof armCount !== "number" || Math.floor(armCount) !== armCount || armCount < 2 || armCount > 0x7fffffff) {
		throw new Error(`armCount must be an integer >= 2, got ${armCount}`);
	}
}

// murmur3_32(le64(seed) ++ le32(murmur3_32(utf8(clusterUnit + "\u001f" + cycleIndex)))). A lone
// surrogate encodes as '?', as the platform's String.getBytes(UTF_8) does.
export function baseHash(clusterUnit: string, cycleIndex: string, seedHi: number, seedLo: number): number {
	const key = toWellFormedString(`${clusterUnit}\u001f${cycleIndex}`, "?");
	const keyHash = murmur3_32(stringToUint8Array(key).buffer);

	const buffer = new ArrayBuffer(12);
	const view = new DataView(buffer);
	view.setUint32(0, seedLo, true);
	view.setUint32(4, seedHi, true);
	view.setUint32(8, keyHash, true);
	return murmur3_32(buffer);
}

// Fisher-Yates over [0, armCount), each swap drawn from murmur3_32(le32(baseHash) ++ le32(i)).
export function fisherYatesPermutation(armCount: number, hash: number): number[] {
	const permutation: number[] = [];
	for (let i = 0; i < armCount; ++i) {
		permutation[i] = i;
	}

	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	view.setUint32(0, hash, true);
	for (let i = armCount - 1; i > 0; --i) {
		view.setUint32(4, i, true);
		const prob = murmur3_32(buffer) * NORMALIZER;
		// prob == 1.0 would map to i + 1
		const j = Math.min(i, Math.floor(prob * (i + 1)));

		const tmp = permutation[i];
		permutation[i] = permutation[j];
		permutation[j] = tmp;
	}

	return permutation;
}

// The balanced-block draw for a period at or after the anchor under the experiment seed
// (seedHi << 32) | (seedLo & 0xffffffff): permutation[floorMod(periodIndex, armCount)] of the cycle
// floorDiv(periodIndex, armCount).
export function assignSwitchbackPeriod(
	clusterKey: string,
	periodIndex: number,
	seedHi: number,
	seedLo: number,
	armCount: number
): number {
	requireValidArmCount(armCount);
	const cycle = Math.floor(periodIndex / armCount);
	return fisherYatesPermutation(armCount, baseHash(clusterKey, String(cycle), seedHi, seedLo))[
		periodIndex - cycle * armCount
	];
}

// A cluster attribute path, resolved like the Collector's SwitchbackAttributePath: "/" separates
// segments, a segment wrapped in ' or " is a literal key, and an unquoted segment that Guava
// Ints.tryParse accepts indexes an array and nothing else. Every other segment reads an object key.
export type SwitchbackAttributePath = { keys: string[]; indices: (number | null)[] };

// Guava Ints.tryParse: an optional '-', then one or more ASCII digits, within int32. "-0" is 0.
export function tryParseInt(value: string): number | null {
	const negative = value.charAt(0) === "-";
	const digits = negative ? value.substring(1) : value;
	if (!/^[0-9]+$/.test(digits)) return null;
	const trimmed = digits.replace(/^0+(?=.)/, "");
	if (trimmed.length > 10) return null;
	const parsed = negative ? -Number(trimmed) : Number(trimmed);
	return parsed >= -2147483648 && parsed <= 2147483647 ? parsed + 0 : null;
}

// Null for an unsupported path: a '.' anywhere (quoted or not, dotted paths are not a nesting
// syntax), an unterminated quote, no segment, or an index that is negative, first, last, or directly
// after another index. Analysis cannot read those.
export function parseSwitchbackPath(path: unknown): SwitchbackAttributePath | null {
	if (typeof path !== "string" || path.indexOf(".") >= 0) return null;

	const keys: string[] = [];
	const indices: (number | null)[] = [];
	let i = 0;
	while (i < path.length) {
		const first = path.charAt(i);
		if (first === "/") {
			++i;
		} else if (first === "'" || first === '"') {
			const end = path.indexOf(first, i + 1);
			if (end < 0) return null;
			keys.push(path.substring(i + 1, end));
			indices.push(null);
			i = end + 1;
		} else {
			const slash = path.indexOf("/", i);
			const end = slash < 0 ? path.length : slash;
			const key = path.substring(i, end);
			keys.push(key);
			indices.push(tryParseInt(key));
			i = end;
		}
	}

	const n = keys.length;
	if (n === 0) return null;
	for (let s = 0; s < n; ++s) {
		const index = indices[s];
		if (index !== null && (index < 0 || s === 0 || s === n - 1 || indices[s - 1] !== null)) return null;
	}
	return { keys, indices };
}

function step(current: unknown, key: string, index: number | null): unknown {
	if (index !== null) {
		return Array.isArray(current) && index < current.length ? current[index] : null;
	}
	if (current !== null && typeof current === "object" && !Array.isArray(current)) {
		return Object.prototype.hasOwnProperty.call(current, key) ? (current as Record<string, unknown>)[key] : null;
	}
	return null;
}

// Resolves the path below its first segment in the value of the attribute that segment names. The
// value is read as the Collector reads it: through its JSON encoding, the form it is published in.
// A value with no JSON encoding (a cycle, a BigInt, undefined) has nothing below it.
export function resolveSwitchbackPath(path: SwitchbackAttributePath, rootValue: unknown): unknown {
	let current: unknown = rootValue;
	if (current !== null && typeof current === "object") {
		try {
			current = JSON.parse(JSON.stringify(current));
		} catch (error) {
			return null;
		}
	}
	for (let s = 1; s < path.keys.length && current != null; ++s) {
		current = step(current, path.keys[s], path.indices[s]);
	}
	return current;
}

// The cluster key a value yields, as the Collector's SwitchbackClusterKeys.normalize keys the value
// this SDK publishes: a non-empty string as-is and a whole number as its base-10 text. A JS number
// cannot tell 3.0 from 3, and both publish as 3, so an integral float is keyed like the integer.
// Every other number (fractions, non-finite, and magnitudes the JSON encoding writes with an
// exponent), booleans, objects, arrays, empty strings and null yield no key.
export function switchbackClusterKey(value: unknown): string | null {
	if (typeof value === "string") return value.length > 0 ? value : null;
	if (typeof value === "number" && Math.floor(value) === value && Math.abs(value) < 1e21) return String(value);
	return null;
}

export const SWITCHBACK_ABSENT = 0;
export const SWITCHBACK_INELIGIBLE = 1;
export const SWITCHBACK_ELIGIBLE = 2;

export type SwitchbackServing = {
	status: number;
	// The serving unit type when eligible, the first linked unit type when ineligible, null when absent.
	unitType: string | null;
	// The raw cluster key when eligible; never hashed.
	clusterKey: string | null;
};

// Which unit serves and under which cluster key, as the Collector's ContextAPI.switchbackServing:
// the sources in declared order, each read for the context's unit of that type (a context holds one
// uid per type). The first unit yielding a value serves; a later different value is a disagreement.
export function resolveSwitchbackServing(
	sourceTypes: string[],
	sourcePaths: SwitchbackAttributePath[],
	allowedValues: unknown,
	units: Record<string, unknown>,
	read: (path: SwitchbackAttributePath) => unknown
): SwitchbackServing {
	let first: string | null = null;
	let serving: string | null = null;
	let key: string | null = null;
	let disagreement = false;
	for (let s = 0; s < sourceTypes.length; ++s) {
		const type = sourceTypes[s];
		if (!Object.prototype.hasOwnProperty.call(units, type) || units[type] == null) continue;
		if (first === null) first = type;
		const value = switchbackClusterKey(read(sourcePaths[s]));
		if (value === null) continue;
		if (key === null) {
			key = value;
			serving = type;
		} else if (key !== value) {
			disagreement = true;
		}
	}

	if (first === null) return { status: SWITCHBACK_ABSENT, unitType: null, clusterKey: null };
	if (key === null || disagreement || !isAllowed(allowedValues, key)) {
		return { status: SWITCHBACK_INELIGIBLE, unitType: first, clusterKey: null };
	}
	return { status: SWITCHBACK_ELIGIBLE, unitType: serving, clusterKey: key };
}

// A null or empty allow-list admits every value. Anything else that is not a list admits none.
function isAllowed(allowedValues: unknown, key: string) {
	if (allowedValues == null) return true;
	if (!Array.isArray(allowedValues)) return false;
	if (allowedValues.length === 0) return true;
	// Compared as text, as Java reads a JSON number in this string list.
	for (const allowed of allowedValues) {
		if (allowed != null && String(allowed) === key) return true;
	}
	return false;
}

// The Collector's path for a missing, empty or unreadable cluster map: the declared unitType only
// identifies an ineligible control; without a unit of that type the experiment does not apply.
export function legacySwitchbackServing(unitType: string | null, units: Record<string, unknown>): SwitchbackServing {
	if (unitType != null && Object.prototype.hasOwnProperty.call(units, unitType) && units[unitType] != null) {
		return { status: SWITCHBACK_INELIGIBLE, unitType, clusterKey: null };
	}
	return { status: SWITCHBACK_ABSENT, unitType: null, clusterKey: null };
}

// An object key JS enumerates before every other key, in ascending numeric order, whatever its
// position in the JSON text (a canonical array index).
function isArrayIndexKey(key: string) {
	return /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < 4294967295;
}

// The linked unit types and parsed paths of a switchbackClusters object in declared order, or null
// for a map the legacy path serves: missing, empty, not an object, with a non-string type or path, or
// with an unsupported path. A map of two or more entries with an array-index unit type name is
// unreadable too: JS moves such keys first, so their declared order is lost in parsing.
export function switchbackSources(clusters: unknown): SwitchbackSources | null {
	if (clusters == null || typeof clusters !== "object" || Array.isArray(clusters)) return null;
	const types = Object.keys(clusters);
	if (types.length === 0) return null;

	const paths: SwitchbackAttributePath[] = [];
	for (const type of types) {
		if (types.length > 1 && isArrayIndexKey(type)) return null;
		const path = parseSwitchbackPath((clusters as Record<string, unknown>)[type]);
		if (path === null) return null;
		paths.push(path);
	}
	return { types, paths };
}

export type SwitchbackSources = { types: string[]; paths: SwitchbackAttributePath[] };

// The Collector's anchor bounds (Registry): hour aligned and in [0, 10000-01-01T00:00:00Z).
const ANCHOR_ALIGNMENT_MS = 3600000;
const MAX_ANCHOR_MS = 253402300800000;

function isWholeNumber(value: unknown): value is number {
	return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
}

// floorDiv(now - switchbackStartAt, switchbackPeriodMs), or null when the draw cannot run: before
// the anchor, or with an unservable schedule (an anchor that is unset, unaligned or out of bounds, a
// period that is unset or not positive, or fewer than two arms). The anchor is used as served, never
// rounded. For non-negative integers below 2^53, Math.floor of the double quotient is the exact floor:
// a non-integral quotient is at least 1/periodMs from the next integer, more than half an ulp there.
export function switchbackPeriodIndex(experiment: ExperimentSchedule, now: number): number | null {
	const startAt = experiment.switchbackStartAt;
	const periodMs = experiment.switchbackPeriodMs;
	if (!isWholeNumber(startAt) || startAt < 0 || startAt >= MAX_ANCHOR_MS || startAt % ANCHOR_ALIGNMENT_MS !== 0) {
		return null;
	}
	if (!isWholeNumber(periodMs) || periodMs <= 0) return null;
	if (!Array.isArray(experiment.split) || experiment.split.length < 2) return null;
	if (now < startAt) return null;
	return Math.floor((now - startAt) / periodMs);
}

type ExperimentSchedule = {
	id: number;
	iteration: number;
	unitType: string | null;
	split: number[];
	switchbackClusters?: unknown;
	switchbackClusterValues?: unknown;
	switchbackStartAt?: unknown;
	switchbackPeriodMs?: unknown;
	switchbackDesignType?: unknown;
};

function orderedEntries(value: unknown): unknown {
	if (value == null) return null;
	if (typeof value !== "object" || Array.isArray(value)) return value;
	const entries: unknown[] = [];
	for (const key of Object.keys(value)) {
		entries.push(key, (value as Record<string, unknown>)[key]);
	}
	return entries;
}

// Shallow equality with null and undefined alike; arrays compare element by element.
function sameValue(a: unknown, b: unknown): boolean {
	if (a == null || b == null) return a == null && b == null;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; ++i) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}
	return a === b;
}

// Whether a refreshed switchback keeps its predecessor's epoch: the same id and iteration, cluster
// map (types, paths and their order), allow-list, anchor, period length and design, plus the same
// unitType when either side takes the legacy path. Seed, split and the analysis-only fields
// (carryover, burn-in, burn-out, estimand) are not identity.
export function sameSwitchbackIdentity(
	previous: ExperimentSchedule,
	previousReadable: boolean,
	installed: ExperimentSchedule,
	installedReadable: boolean
): boolean {
	return (
		previous.id === installed.id &&
		previous.iteration === installed.iteration &&
		sameValue(orderedEntries(previous.switchbackClusters), orderedEntries(installed.switchbackClusters)) &&
		sameValue(previous.switchbackClusterValues, installed.switchbackClusterValues) &&
		sameValue(previous.switchbackStartAt, installed.switchbackStartAt) &&
		sameValue(previous.switchbackPeriodMs, installed.switchbackPeriodMs) &&
		sameValue(previous.switchbackDesignType, installed.switchbackDesignType) &&
		((previousReadable && installedReadable) || sameValue(previous.unitType, installed.unitType))
	);
}
