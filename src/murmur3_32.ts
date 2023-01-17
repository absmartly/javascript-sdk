const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;
const C3 = 0xe6546b64;

const imul32 = Math.imul;

function fmix32(h: number) {
	h ^= h >>> 16;
	h = imul32(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = imul32(h, 0xc2b2ae35);
	h ^= h >>> 16;

	return h >>> 0;
}

function rotl32(a: number, b: number) {
	return (a << b) | (a >>> (32 - b));
}

function scramble32(block: number) {
	return imul32(rotl32(imul32(block, C1), 15), C2);
}

export function murmur3_32(key: ArrayBufferLike, hash?: number) {
	hash = (hash || 0) >>> 0;
	const dataView = new DataView(key);

	let i;
	const n = dataView.byteLength & ~3;
	for (i = 0; i < n; i += 4) {
		const chunk = dataView.getUint32(i, true);
		hash ^= scramble32(chunk);
		hash = rotl32(hash, 13);
		hash = imul32(hash, 5) + C3;
	}

	let remaining = 0;
	switch (dataView.byteLength & 3) {
		case 3:
			remaining ^= dataView.getUint8(i + 2) << 16;
		// fallthrough
		case 2:
			remaining ^= dataView.getUint8(i + 1) << 8;
		// fallthrough
		case 1:
			remaining ^= dataView.getUint8(i);
			hash ^= scramble32(remaining);
		// fallthrough
		default:
			break;
	}

	hash ^= dataView.byteLength;
	hash = fmix32(hash);
	return hash >>> 0;
}
