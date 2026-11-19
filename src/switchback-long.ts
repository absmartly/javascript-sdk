import { baseHash, fisherYatesPermutation, requireValidArmCount } from "./switchback";

// The switchback assigner over the full signed 64-bit range of periods, cycles and seeds, which the
// platform golden vectors pin (Long.MIN_VALUE and Long.MAX_VALUE included). Context never needs it:
// its period index is a non-negative safe integer (see assignSwitchbackPeriod).

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

function requireInt64(field: string, value: string): Int64 {
	const parsed = typeof value === "string" ? parseInt64(value) : null;
	if (parsed === null) throw new Error(`${field} must be a signed 64-bit decimal string, got ${value}`);
	return parsed;
}

// assignSwitchback(clusterUnit, periodIndex, seed, armCount), periodIndex and seed as decimal strings.
export function assignSwitchback(clusterUnit: string, periodIndex: string, seed: string, armCount: number): number {
	requireValidArmCount(armCount);
	const { hi, lo } = int64Words(requireInt64("seed", seed));
	const { quotient, modulo } = floorDivMod(requireInt64("periodIndex", periodIndex), armCount);
	return fisherYatesPermutation(armCount, baseHash(clusterUnit, int64ToDecimal(quotient), hi, lo))[modulo];
}

// fisherYatesPermutation(armCount, baseHash(clusterUnit, cycleIndex, seed)), decimal-string inputs.
export function switchbackPermutation(clusterUnit: string, cycleIndex: string, seed: string, armCount: number) {
	requireValidArmCount(armCount);
	const { hi, lo } = int64Words(requireInt64("seed", seed));
	const cycle = int64ToDecimal(requireInt64("cycleIndex", cycleIndex));
	return fisherYatesPermutation(armCount, baseHash(clusterUnit, cycle, hi, lo));
}
