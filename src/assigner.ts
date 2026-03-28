import { chooseVariant } from "./utils";
import { stringToUint8Array } from "./hashing";
import { murmur3_32 } from "./murmur3";

export class VariantAssigner {
	private readonly _unitHash: number;

	constructor(unit: string) {
		this._unitHash = murmur3_32(stringToUint8Array(unit).buffer);
	}

	assign(split: number[], seedHi: number, seedLo: number): number {
		const prob = this._probability(seedHi, seedLo);
		return chooseVariant(split, prob);
	}

	private _probability(seedHi: number, seedLo: number): number {
		const key = this._unitHash;
		const buffer = new ArrayBuffer(12);
		const view = new DataView(buffer);
		view.setUint32(0, seedLo, true);
		view.setUint32(4, seedHi, true);
		view.setUint32(8, key, true);
		return murmur3_32(buffer) * (1.0 / 0xffffffff);
	}
}
