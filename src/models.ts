export type JSONPrimitive = string | number | boolean | null;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type CustomFieldValueType = "text" | "string" | "number" | "json" | "boolean";

export interface CustomFieldValue {
	name: string;
	value: string | null;
	type: CustomFieldValueType;
}

export interface ExperimentVariant {
	name: string;
	config: string | null;
}

export interface ExperimentApplication {
	name: string;
}

export interface ExperimentData {
	id: number;
	name: string;
	unitType: string | null;
	iteration: number;
	fullOnVariant: number;
	trafficSplit: number[];
	trafficSeedHi: number;
	trafficSeedLo: number;
	audience: string;
	audienceStrict: boolean;
	split: number[];
	seedHi: number;
	seedLo: number;
	variants: ExperimentVariant[];
	applications: ExperimentApplication[];
	customFieldValues: CustomFieldValue[] | null;
}

export interface Assignment {
	id: number;
	iteration: number;
	fullOnVariant: number;
	unitType: string | null;
	variant: number;
	overridden: boolean;
	assigned: boolean;
	exposed: boolean;
	eligible: boolean;
	fullOn: boolean;
	custom: boolean;
	audienceMismatch: boolean;
	trafficSplit: number[] | null;
	variables: Record<string, unknown> | null;
	attrsSeq: number;
}

export type Experiment = {
	data: ExperimentData;
	variables: Record<string, unknown>[];
};

export interface Unit {
	type: string;
	uid: string | null;
}

export interface Exposure {
	id: number;
	name: string;
	exposedAt: number;
	unit: string | null;
	variant: number;
	assigned: boolean;
	eligible: boolean;
	overridden: boolean;
	fullOn: boolean;
	custom: boolean;
	audienceMismatch: boolean;
}

export interface Attribute {
	name: string;
	value: unknown;
	setAt: number;
}

export type Units = Record<string, string | number>;

export interface GoalAchievement {
	name: string;
	properties: Record<string, unknown> | null;
	achievedAt: number;
}

export interface ContextData {
	experiments?: ExperimentData[];
}

export type ApplicationObject = { name: string; version: number | string };

export interface PublishParams {
	units: Unit[];
	publishedAt: number;
	hashed: boolean;
	sdkVersion: string;
	attributes?: Attribute[];
	goals?: GoalAchievement[];
	exposures?: Exposure[];
}
