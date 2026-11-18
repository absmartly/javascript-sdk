import { murmur3_32 } from "./murmur3_32";
import { stringToUint8Array, toWellFormedString } from "./utils";

// Switchback experiments (R33, cluster-defined): a port of java-sdk's internal Switchback* classes,
// which port the platform's SwitchbackAssignment and the Collector's ContextAPI.switchbackServing.
// See the README section "Switchback experiments" for the serving rules.

// A signed 64-bit integer as a sign and a magnitude in four little-endian 16-bit limbs. JS numbers
// are exact only up to 2^53, and BigInt is unavailable on the declared IE 10 / Node 6 targets.
type Int64 = { negative: boolean; limbs: number[] };

const INT64_MAX_DECIMAL = "9223372036854775807";
const INT64_MIN_MAGNITUDE_DECIMAL = "9223372036854775808";

// A decimal integer in [-2^63, 2^63 - 1] as Java's Long.parseLong reads it (an optional sign, then
// ASCII digits), or null.
export function parseInt64(value: string): Int64 | null {
	const sign = value.charAt(0);
	const negative = sign === "-";
	const digits = negative || sign === "+" ? value.substring(1) : value;
	if (!/^[0-9]+$/.test(digits)) return null;

	const trimmed = digits.replace(/^0+(?=.)/, "");
	const bound = negative ? INT64_MIN_MAGNITUDE_DECIMAL : INT64_MAX_DECIMAL;
	if (trimmed.length > bound.length || (trimmed.length === bound.length && trimmed > bound)) return null;

	const limbs = [0, 0, 0, 0];
	for (let i = 0; i < trimmed.length; ++i) {
		let carry = trimmed.charCodeAt(i) - 48;
		for (let l = 0; l < 4; ++l) {
			const v = limbs[l] * 10 + carry;
			limbs[l] = v & 0xffff;
			carry = Math.floor(v / 0x10000);
		}
	}
	return { negative: negative && trimmed !== "0", limbs };
}

// A non-negative safe integer as an Int64.
function int64FromNonNegative(value: number): Int64 {
	const hi = Math.floor(value / 0x100000000);
	const lo = value - hi * 0x100000000;
	return { negative: false, limbs: [lo & 0xffff, lo >>> 16, hi & 0xffff, hi >>> 16] };
}

// Divides a magnitude by a positive integer below 2^37, so every partial dividend stays below 2^53.
function divideMagnitude(limbs: number[], divisor: number): { quotient: number[]; remainder: number } {
	const quotient = [0, 0, 0, 0];
	let remainder = 0;
	for (let l = 3; l >= 0; --l) {
		const v = remainder * 0x10000 + limbs[l];
		quotient[l] = Math.floor(v / divisor);
		remainder = v - quotient[l] * divisor;
	}
	return { quotient, remainder };
}

function isZero(limbs: number[]) {
	return (limbs[0] | limbs[1] | limbs[2] | limbs[3]) === 0;
}

function increment(limbs: number[]): number[] {
	const result = limbs.slice();
	for (let l = 0; l < 4; ++l) {
		if (result[l] < 0xffff) {
			++result[l];
			return result;
		}
		result[l] = 0;
	}
	return result;
}

// floorDiv and floorMod by a positive divisor, as Java's Math.floorDiv / Math.floorMod.
function floorDivMod(value: Int64, divisor: number): { quotient: Int64; modulo: number } {
	const { quotient, remainder } = divideMagnitude(value.limbs, divisor);
	if (!value.negative) return { quotient: { negative: false, limbs: quotient }, modulo: remainder };
	if (remainder === 0) return { quotient: { negative: !isZero(quotient), limbs: quotient }, modulo: 0 };
	return { quotient: { negative: true, limbs: increment(quotient) }, modulo: divisor - remainder };
}

// Signed base-10 text with no leading zeros, as Java's Long.toString.
function int64ToDecimal(value: Int64): string {
	let limbs = value.limbs;
	if (isZero(limbs)) return "0";
	let text = "";
	while (!isZero(limbs)) {
		const { quotient, remainder } = divideMagnitude(limbs, 10000);
		limbs = quotient;
		const chunk = String(remainder);
		text = (isZero(limbs) ? chunk : "0000".substring(chunk.length) + chunk) + text;
	}
	return value.negative ? `-${text}` : text;
}

// The two's-complement 32-bit halves: (int) value and (int) (value >>> 32).
function int64Words(value: Int64): { hi: number; lo: number } {
	let lo = (value.limbs[0] | (value.limbs[1] << 16)) >>> 0;
	let hi = (value.limbs[2] | (value.limbs[3] << 16)) >>> 0;
	if (value.negative) {
		lo = (~lo + 1) >>> 0;
		hi = (~hi + (lo === 0 ? 1 : 0)) >>> 0;
	}
	return { hi: hi | 0, lo: lo | 0 };
}

const NORMALIZER = 1.0 / 0xffffffff;

function requireValidArmCount(armCount: number) {
	if (typeof armCount !== "number" || Math.floor(armCount) !== armCount || armCount < 2 || armCount > 0x7fffffff) {
		throw new Error(`armCount must be an integer >= 2, got ${armCount}`);
	}
}

// murmur3_32(le64(seed) ++ le32(murmur3_32(utf8(clusterUnit + "\u001f" + cycleIndex)))). A lone
// surrogate encodes as '?', as the platform's String.getBytes(UTF_8) does.
function baseHash(clusterUnit: string, cycleIndex: string, seedHi: number, seedLo: number): number {
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
function fisherYatesPermutation(armCount: number, hash: number): number[] {
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

function assign(clusterUnit: string, periodIndex: Int64, seedHi: number, seedLo: number, armCount: number) {
	const { quotient, modulo } = floorDivMod(periodIndex, armCount);
	return fisherYatesPermutation(armCount, baseHash(clusterUnit, int64ToDecimal(quotient), seedHi, seedLo))[modulo];
}

// The balanced-block draw for a period at or after the anchor (periodIndex a non-negative safe
// integer) under the experiment seed (seedHi << 32) | (seedLo & 0xffffffff).
export function assignSwitchbackPeriod(
	clusterKey: string,
	periodIndex: number,
	seedHi: number,
	seedLo: number,
	armCount: number
): number {
	requireValidArmCount(armCount);
	return assign(clusterKey, int64FromNonNegative(periodIndex), seedHi, seedLo, armCount);
}

function requireInt64(field: string, value: string): Int64 {
	const parsed = typeof value === "string" ? parseInt64(value) : null;
	if (parsed === null) throw new Error(`${field} must be a signed 64-bit decimal string, got ${value}`);
	return parsed;
}

// assignSwitchback(clusterUnit, periodIndex, seed, armCount) over the full signed 64-bit range;
// periodIndex and seed are decimal strings. Pinned by the platform golden vectors.
export function assignSwitchback(clusterUnit: string, periodIndex: string, seed: string, armCount: number): number {
	requireValidArmCount(armCount);
	const { hi, lo } = int64Words(requireInt64("seed", seed));
	return assign(clusterUnit, requireInt64("periodIndex", periodIndex), hi, lo, armCount);
}

// fisherYatesPermutation(armCount, baseHash(clusterUnit, cycleIndex, seed)), decimal-string inputs.
export function switchbackPermutation(clusterUnit: string, cycleIndex: string, seed: string, armCount: number) {
	requireValidArmCount(armCount);
	const { hi, lo } = int64Words(requireInt64("seed", seed));
	const cycle = int64ToDecimal(requireInt64("cycleIndex", cycleIndex));
	return fisherYatesPermutation(armCount, baseHash(clusterUnit, cycle, hi, lo));
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
	return allowedValues.length === 0 || allowedValues.indexOf(key) >= 0;
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
// rounded.
export function switchbackPeriodIndex(experiment: ExperimentSchedule, now: number): number | null {
	const startAt = experiment.switchbackStartAt;
	const periodMs = experiment.switchbackPeriodMs;
	if (!isWholeNumber(startAt) || startAt < 0 || startAt >= MAX_ANCHOR_MS || startAt % ANCHOR_ALIGNMENT_MS !== 0) {
		return null;
	}
	if (!isWholeNumber(periodMs) || periodMs <= 0) return null;
	if (!Array.isArray(experiment.split) || experiment.split.length < 2) return null;
	if (now < startAt) return null;
	const elapsed = now - startAt;
	// A rounded quotient can land on the next integer; the remainder check corrects it.
	let index = Math.floor(elapsed / periodMs);
	if (index * periodMs > elapsed) --index;
	return index;
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
