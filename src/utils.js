import { md5 } from "./md5";

export function isNumeric(value) {
	return typeof value === "number";
}

export function isObject(value) {
	return value instanceof Object && value.constructor === Object;
}

export function arrayEqualsShallow(a, b) {
	return a.length === b.length && a.every((va, vi) => b[vi] === va);
}

export function stringToUint8Array(value) {
	const n = value.length;
	const array = new Array(value.length);

	let k = 0;
	for (let i = 0; i < n; ++i) {
		const c = value.charCodeAt(i);
		if (c < 0x80) {
			array[k++] = c;
		} else if (c < 0x800) {
			array[k++] = (c >> 6) | 192;
			array[k++] = (c & 63) | 128;
		} else {
			array[k++] = (c >> 12) | 224;
			array[k++] = ((c >> 6) & 63) | 128;
			array[k++] = (c & 63) | 128;
		}
	}
	return Uint8Array.from(array);
}

const Base64URLNoPaddingChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function base64UrlNoPadding(value) {
	const chars = Base64URLNoPaddingChars;

	const remaining = value.byteLength % 3;
	const encodeLen = ((value.byteLength / 3) | 0) * 4 + (remaining === 0 ? 0 : remaining === 1 ? 2 : 3);
	const result = new Array(encodeLen);

	let i;
	let out = 0;
	const len = value.byteLength - remaining;
	for (i = 0; i < len; i += 3) {
		const bytes = (value[i] << 16) | (value[i + 1] << 8) | value[i + 2];
		result[out] = chars[(bytes >> 18) & 63];
		result[out + 1] = chars[(bytes >> 12) & 63];
		result[out + 2] = chars[(bytes >> 6) & 63];
		result[out + 3] = chars[bytes & 63];
		out += 4;
	}

	switch (remaining) {
		case 2:
			{
				const bytes = (value[i] << 16) | (value[i + 1] << 8);
				result[out] = chars[(bytes >> 18) & 63];
				result[out + 1] = chars[(bytes >> 12) & 63];
				result[out + 2] = chars[(bytes >> 6) & 63];
			}
			break;
		case 1:
			{
				const bytes = value[i] << 16;
				result[out] = chars[(bytes >> 18) & 63];
				result[out + 1] = chars[(bytes >> 12) & 63];
			}
			break;
		default:
			break;
	}

	return result.join("");
}

export function hashUnit(value) {
	const unit = typeof value === "string" ? value : value.toFixed(0);
	return base64UrlNoPadding(md5(stringToUint8Array(unit).buffer));
}

export function chooseVariant(split, prob) {
	let cumSum = 0.0;
	for (let i = 0; i < split.length; ++i) {
		cumSum += split[i];
		if (prob < cumSum) {
			return i;
		}
	}

	return split.length - 1;
}
