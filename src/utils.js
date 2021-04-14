export function isNumeric(value) {
	return typeof value === "number";
}

export function isObject(value) {
	return value instanceof Object && value.constructor === Object;
}
