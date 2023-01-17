export const insertUniqueSorted = (arr: any[], value: any, isSorted: (a: any, b: any) => boolean) => {
	let left = 0;
	let right = arr.length - 1;

	while (left <= right) {
		const mid = Math.floor(left + (right - left) / 2);

		if (isSorted(arr[mid], value)) {
			left = mid + 1;
		} else if (isSorted(value, arr[mid])) {
			right = mid - 1;
		} else {
			return;
		}
	}

	arr.splice(left, 0, value);
};
