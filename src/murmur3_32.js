const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;
const C3 = 0xe6546b64;

export function imultiply(a, b) {
	//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul
	b |= 0;
	let result = (a & 0x003fffff) * b;
	if ((a & 0xffc00000) !== 0) result += ((a & 0xffc00000) * b) | 0;
	return result | 0;
}

const imul32 = Math.imul || imultiply;

function fmix32(h) {
	h ^= h >>> 16;
	h = imul32(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = imul32(h, 0xc2b2ae35);
	h ^= h >>> 16;

	return h >>> 0;
}

function rotl32(a, b) {
	return (a << b) | (a >>> (32 - b));
}

function scramble32(block) {
	return imul32(rotl32(imul32(block, C1), 15), C2);
}

export function murmur3_32(key, hash) {
	hash = (hash || 0) >>> 0;
	key = new DataView(key);

	let i;
	const n = key.byteLength & ~3;
	for (i = 0; i < n; i += 4) {
		const chunk = key.getUint32(i, true);
		hash ^= scramble32(chunk);
		hash = rotl32(hash, 13);
		hash = imul32(hash, 5) + C3;
	}

	let remaining = 0;
	switch (key.byteLength & 3) {
		case 3:
			remaining ^= key.getUint8(i + 2) << 16;
		// fallthrough
		case 2:
			remaining ^= key.getUint8(i + 1) << 8;
		// fallthrough
		case 1:
			remaining ^= key.getUint8(i);
			hash ^= scramble32(remaining);
		// fallthrough
		default:
			break;
	}

	hash ^= key.byteLength;
	hash = fmix32(hash);
	return hash >>> 0;
}
