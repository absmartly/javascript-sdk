import { chooseVariant, stringToUint8Array } from "./utils";
import { murmur3_32 } from "./murmur3_32";

export class VariantAssigner {
	constructor(unit) {
		this._unitHash = murmur3_32(stringToUint8Array(unit).buffer);
	}

	assign(split, seedHi, seedLo) {
		const prob = this._probability(seedHi, seedLo);
		return chooseVariant(split, prob);
	}

	_probability(seedHi, seedLo) {
		const key = this._unitHash;
		const buffer = new ArrayBuffer(12);
		const view = new DataView(buffer);
		view.setUint32(0, seedLo, true);
		view.setUint32(4, seedHi, true);
		view.setUint32(8, key, true);

		return murmur3_32(buffer) * (1.0 / 0xffffffff);
	}
}
