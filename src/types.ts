import Client from "./client";
import Context from "./context";
import { ContextDataProvider } from "./provider";
import { ContextPublisher } from "./publisher";
// eslint-disable-next-line no-shadow
import { AbortSignal } from "./abort-controller-shim";

export type AbortControllerEvents = {
	[key: string]: Array<() => unknown>;
};

export type Unit = {
	type: string;
	uid: string | null;
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
};

export type ContextData = {
	experiments?: ExperimentData[];
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

export type Units = {
	[key: string]: string | number;
};

export type Goal = {
	name: string;
	properties: Record<string, unknown> | null;
	achievedAt: number;
};

export type PublishParams = {
	units: Unit[];
	publishedAt: number;
	hashed: boolean;
	attributes?: Attribute[];
	goals?: Goal[];
	exposures?: Exposure[];
};

export type EventLoggerData = Error | Exposure | Goal | ContextData | PublishParams;

export type EventLogger = (context: Context, eventName: string, data?: EventLoggerData) => void;

export type FetchResponse = {
	status: number;
	ok: boolean;
	text: () => Promise<string>;
	statusText: string;
	json: () => Promise<string>;
};

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
	agent?: "javascript-client";
	apiKey: string;
	application: string | { name: string; version: number };
	endpoint: string;
	environment: string;
	retries?: number;
	timeout?: number;
	keepalive?: boolean;
};

export type SDKOptions = {
	client?: Client;
	eventLogger?: EventLogger;
	publisher?: ContextPublisher;
	provider?: ContextDataProvider;
};

export type ContextParams = {
	units: Record<string, string | number>;
};

export type ContextOptions = {
	publisher?: ContextPublisher;
	dataProvider?: ContextDataProvider;
	eventLogger?: EventLogger;
	refreshPeriod: number;
	publishDelay: number;
};

export type Experiment = {
	data: ExperimentData;
	variables: Record<string, unknown>[];
};

export type FetchOptions = {
	signal?: AbortSignal;
	method?: "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
	credentials?: "include";
	headers?: Record<string, string>;
	body?: XMLHttpRequestBodyInit;
};
