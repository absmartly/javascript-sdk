export function isObject(value: unknown): value is Record<string, unknown> {
	if (!(value instanceof Object)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto == null || proto === Object.prototype;
}

export function isPromise(value: unknown): value is Promise<unknown> {
	return value !== null && typeof value === "object" && typeof (value as Promise<unknown>).then === "function";
}

function arrayEqualsDeep(a: unknown[], b: unknown[], astack: unknown[] = [], bstack: unknown[] = []): boolean {
	let len = astack.length;
	while (len--) {
		if (astack[len] === a) return bstack[len] === b;
	}

	astack.push(a);
	bstack.push(b);

	len = a.length;
	while (len--) {
		if (!isEqualsDeep(a[len], b[len], astack, bstack)) return false;
	}

	bstack.pop();
	astack.pop();

	return true;
}

function objectEqualsDeep(
	a: Record<string | number | symbol, unknown>,
	b: Record<string | number | symbol, unknown>,
	keys: string[],
	astack?: unknown[],
	bstack?: unknown[],
): boolean {
	let len = astack?.length ?? 0;
	while (len--) {
		if (astack && astack[len] === a) return bstack !== undefined && bstack[len] === b;
	}

	astack = astack ?? [];
	bstack = bstack ?? [];

	astack.push(a);
	bstack.push(b);

	len = keys.length;
	while (len--) {
		const key = keys[len]!;
		if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
		if (!isEqualsDeep(a[key], b[key], astack, bstack)) return false;
	}

	bstack.pop();
	astack.pop();

	return true;
}

export function isEqualsDeep(a: unknown, b: unknown, astack?: unknown[], bstack?: unknown[]): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;

	switch (typeof a) {
		case "boolean":
			return a === b;
		case "number":
			if (Number.isNaN(a)) return Number.isNaN(b as number);
			return a === b;
		case "string":
			return a === b;
		case "object": {
			const arrays = Array.isArray(a);
			if (arrays && !Array.isArray(b)) return false;

			const objects = isObject(a);
			if (objects && !isObject(b)) return false;

			if (!arrays && !objects) return false;

			if (arrays && Array.isArray(b)) {
				if (a.length === b.length) {
					return arrayEqualsDeep(a, b, astack, bstack);
				}
			} else if (a && b) {
				const keys = Object.keys(a);
				if (keys.length === Object.keys(b as Record<string, unknown>).length) {
					return objectEqualsDeep(
						a as Record<string, unknown>,
						b as Record<string, unknown>,
						keys,
						astack,
						bstack,
					);
				}
			}
			break;
		}
		default:
			break;
	}
	return false;
}

export function arrayEqualsShallow(a?: unknown[], b?: unknown[]): boolean {
	return a === b || (a?.length === b?.length && !a?.some((va, vi) => b && va !== b[vi]));
}

export function chooseVariant(split: number[], prob: number): number {
	let cumSum = 0.0;
	for (let i = 0; i < split.length; ++i) {
		cumSum += split[i]!;
		if (prob < cumSum) return i;
	}
	return split.length - 1;
}
