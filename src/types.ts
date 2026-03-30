export type JSONPrimitive = string | number | boolean | null;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type CustomFieldValueType = "text" | "string" | "number" | "json" | "boolean";

export type CustomFieldValue = {
	name: string;
	value: string;
	type: CustomFieldValueType;
};

export type ExperimentData = {
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
	variants: { config: null | string }[];
	variables: Record<string, unknown>;
	variant: number;
	overridden: boolean;
	assigned: boolean;
	exposed: boolean;
	eligible: boolean;
	fullOn: boolean;
	custom: boolean;
	audienceMismatch: boolean;
	customFieldValues: CustomFieldValue[] | null;
};

export type Assignment = {
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
	trafficSplit?: number[];
	variables?: Record<string, unknown>;
	attrsSeq?: number;
};

export type Experiment = {
	data: ExperimentData;
	variables: Record<string, unknown>[];
};

export type Unit = {
	type: string;
	uid: string | null;
};

export type Exposure = {
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
};

export type Attribute = {
	name: string;
	value: unknown;
	setAt: number;
};

export type Units = Record<string, string | number>;

export type Goal = {
	name: string;
	properties: Record<string, unknown> | null;
	achievedAt: number;
};

export type ContextParams = {
	units: Record<string, string | number>;
};

export type ContextData = {
	experiments?: ExperimentData[];
};

export type ApplicationObject = { name: string; version: number | string };

export type ClientRequestOptions = {
	query?: Record<string, string | number | boolean>;
	path: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
	body?: Record<string, unknown>;
	auth?: boolean;
	signal?: AbortSignal;
	timeout?: number;
};

export type ClientOptions = {
	agent?: string;
	apiKey: string;
	application: string | ApplicationObject;
	endpoint: string;
	environment: string;
	retries?: number;
	timeout?: number;
	keepalive?: boolean;
	fetchImpl?: typeof fetch;
	AbortControllerImpl?: typeof AbortController;
};

export type NormalizedClientOptions = Omit<Required<ClientOptions>, "application"> & {
	application: ApplicationObject;
};

export type PublishParams = {
	units: Unit[];
	publishedAt: number;
	hashed: boolean;
	sdkVersion: string;
	attributes?: Attribute[];
	goals?: Goal[];
	exposures?: Exposure[];
};

export type EventName = "error" | "ready" | "refresh" | "publish" | "exposure" | "goal" | "finalize";

export type EventLoggerData = Error | Exposure | Goal | ContextData | PublishParams;

export type EventLogger = (context: unknown, eventName: EventName, data?: EventLoggerData) => void;
