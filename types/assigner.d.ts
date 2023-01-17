export declare class VariantAssigner {
    private readonly _unitHash;
    constructor(unit: string);
    assign(split: number[], seedHi: number, seedLo: number): number;
    _probability(seedHi: number, seedLo: number): number;
}
