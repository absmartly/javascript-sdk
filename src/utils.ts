import { md5 } from "./md5";

declare global {
	interface Window {
		constructor: {
			name: string;
		};
	}
}

export function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof window.document !== "undefined";
}

export function isWorker(): boolean {
	return typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";
}

export function isNumeric(value: number | string | boolean | undefined[] | {}): boolean {
	return typeof value === "number";
}

export function isObject(value: Object): boolean {
	return value instanceof Object && value.constructor === Object;
}

export function arrayEqualsShallow(a: number[], b: number[] | string[] | (number | string)[]): boolean {
	return a.length === b.length && a.every((va, vi) => b[vi] === va);
}

export function stringToUint8Array(value: any): Uint8Array {
	const n = value.length;
	const array = new Array(value.length);

	let k: number = 0;
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

export function base64UrlNoPadding(value: ArrayBuffer | ArrayBufferView | ArrayBufferLike): string {
	const chars = Base64URLNoPaddingChars;

	const remaining = value.byteLength % 3;
	const encodeLen = ((value.byteLength / 3) | 0) * 4 + (remaining === 0 ? 0 : remaining === 1 ? 2 : 3);
	const result = new Array(encodeLen);

	let i: number;
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

export function hashUnit(value: string | number) {
	const unit = typeof value === "string" ? value : value.toFixed(0);
	return base64UrlNoPadding(md5(stringToUint8Array(unit).buffer));
}

export function chooseVariant(split: number[] | number, prob: number): number {
	let cumSum = 0.0;
	if (typeof split === "object") {
		for (let i = 0; i < split.length; ++i) {
			cumSum += split[i];
			if (prob < cumSum) {
				return i;
			}
		}
		return split.length - 1;
	}
}
