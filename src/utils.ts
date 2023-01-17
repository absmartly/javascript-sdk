import { md5 } from "./md5";

export const getApplicationName = (app: string | { name: string; version: number }): string =>
	typeof app !== "string" ? app.name : app;

export const getApplicationVersion = (app: string | { name: string; version: number }): number =>
	typeof app !== "string" ? app.version : 0;

export function isBrowser() {
	return typeof window !== "undefined" && typeof window.document !== "undefined";
}

export function isWorker() {
	return typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";
}

export function isNumeric(value: any) {
	return typeof value === "number";
}

export function isObject(value: any) {
	return value instanceof Object && value.constructor === Object;
}

export function isPromise(value: any) {
	return value !== null && typeof value === "object" && typeof value.then === "function";
}

function arrayEqualsDeep(a: any, b: any, astack: any[] = [], bstack: any[] = []) {
	let len = astack?.length ?? 0;
	while (len--) {
		if (astack[len] === a) return bstack[len] === b;
	}

	astack = astack ?? [];
	bstack = bstack ?? [];

	astack.push(a);
	bstack.push(b);

	len = a.length;
	while (len--) {
		// eslint-disable-next-line no-use-before-define
		if (!isEqualsDeep(a[len], b[len], astack, bstack)) return false;
	}

	bstack.pop();
	astack.pop();

	return true;
}

function objectEqualsDeep(a: any, b: any, keys: string[], astack?: any[], bstack?: any[]) {
	let len = astack?.length ?? 0;
	while (len--) {
		if (astack && astack[len] === a) return bstack && bstack[len] === b;
	}

	astack = astack ?? [];
	bstack = bstack ?? [];

	astack.push(a);
	bstack.push(b);

	len = keys.length;
	while (len--) {
		const key = keys[len];
		// eslint-disable-next-line no-prototype-builtins
		if (!Object.prototype.hasOwnProperty.call(b, key)) return false;

		// eslint-disable-next-line no-use-before-define
		if (!isEqualsDeep(a[key], b[key], astack, bstack)) return false;
	}

	bstack.pop();
	astack.pop();

	return true;
}

export function isEqualsDeep(a: any, b: any, astack?: any[], bstack?: any[]) {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;

	switch (typeof a) {
		case "boolean":
			return a === b;
		case "number":
			if (Number.isNaN(a)) return Number.isNaN(b);
			return a === b;
		case "string":
			return a === b;
		case "object": {
			const arrays = Array.isArray(a);
			if (arrays && !Array.isArray(b)) return false;

			const objects = isObject(a);
			if (objects && !isObject(b)) return false;

			if (!arrays && !objects) return false;

			if (arrays) {
				if (a.length === b.length) {
					return arrayEqualsDeep(a, b, astack, bstack);
				}
			} else {
				const keys = Object.keys(a);
				if (keys.length === Object.keys(b).length) {
					return objectEqualsDeep(a, b, keys, astack, bstack);
				}
			}
			break;
		}
		default:
			break;
	}
	return false;
}

export function arrayEqualsShallow(a: any[], b: any[]) {
	return a === b || (a.length === b.length && !a.some((va, vi) => va !== b[vi]));
}

export function stringToUint8Array(value: string) {
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

export function base64UrlNoPadding(value: Uint8Array) {
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

export function hashUnit(value: string | number) {
	const unit = typeof value === "string" ? value : value.toFixed(0);
	return base64UrlNoPadding(md5(stringToUint8Array(unit).buffer));
}

export function chooseVariant(split: number[], prob: number) {
	let cumSum = 0.0;
	for (let i = 0; i < split.length; ++i) {
		cumSum += split[i];
		if (prob < cumSum) {
			return i;
		}
	}

	return split.length - 1;
}
