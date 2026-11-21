/* eslint-disable no-shadow, no-void, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import absmartly, {
	SDK,
	Context,
	ContextDataProvider,
	ContextPublisher,
	mergeConfig,
	AbortController,
} from "@absmartly/javascript-sdk";
import Client, { ClientRequestOptions, ClientOptions } from "@absmartly/javascript-sdk/types/client";
import {
	ContextData,
	ContextOptions,
	ContextParams,
	ExperimentData,
	Experiment,
	Exposure,
	Attribute,
	Goal,
	Unit,
	Units,
} from "@absmartly/javascript-sdk/types/context";
import { EventLogger, EventName, EventLoggerData, SDKOptions } from "@absmartly/javascript-sdk/types/sdk";
import { PublishParams } from "@absmartly/javascript-sdk/types/publisher";

const experiment: ExperimentData = {
	id: 1,
	name: "example",
	unitType: "session",
	iteration: 1,
	fullOnVariant: 0,
	trafficSplit: [1, 1],
	trafficSeedHi: 1,
	trafficSeedLo: 2,
	audience: "",
	audienceStrict: false,
	split: [1, 1],
	seedHi: 3,
	seedLo: 4,
	variants: [{ config: null }, { config: "{}" }],
	variables: {},
	variant: 0,
	overridden: false,
	assigned: false,
	exposed: false,
	eligible: true,
	fullOn: false,
	custom: false,
	audienceMismatch: false,
	customFieldValues: null,
};
const wrapped: Experiment = { data: experiment, variables: [{}, {}] };
const exposure: Exposure = {
	id: 1,
	name: "example",
	exposedAt: 0,
	unit: "id",
	variant: 1,
	assigned: true,
	eligible: true,
	overridden: false,
	fullOn: false,
	custom: false,
	audienceMismatch: false,
};
const unit: Unit = { type: "session", uid: "id" };
const attribute: Attribute = { name: "country", value: "US", setAt: 0 };
const goal: Goal = { name: "purchase", properties: { amount: 5 }, achievedAt: 0 };
const units: Units = { session: "id", user: 1 };
const payload: PublishParams = {
	units: [unit],
	publishedAt: 0,
	hashed: false,
	exposures: [exposure],
	attributes: [attribute],
	goals: [goal],
};
const data: ContextData = { experiments: [experiment] };
const params: ContextParams = { units };
const request: ClientRequestOptions = { path: "/context", method: "GET", query: { test: true } };

class Provider extends ContextDataProvider {
	getContextData(_sdk: SDK, _options?: Partial<ClientRequestOptions>): Promise<ContextData> {
		return Promise.resolve(data);
	}
}
class Publisher extends ContextPublisher {
	publish(_request: PublishParams, _sdk: SDK, _context: Context, _options?: ClientRequestOptions): Promise<void> {
		return Promise.resolve();
	}
}
const logger: EventLogger = (_context: Context, event: EventName, info?: EventLoggerData): void => {
	void event;
	void info;
};
const clientOptions: ClientOptions = {
	endpoint: "https://example.test/v1",
	apiKey: "key",
	application: "web",
	environment: "test",
};
const options: SDKOptions = { provider: new Provider(), publisher: new Publisher(), eventLogger: logger };
const contextOptions: ContextOptions = {
	refreshPeriod: 0,
	publishDelay: 0,
	dataProvider: options.provider,
	publisher: options.publisher,
	eventLogger: logger,
};
const sdk = new absmartly.SDK({ ...clientOptions, ...options });
const namedSdk: SDK = sdk;
sdk.setEventLogger(logger);
sdk.setContextPublisher(new Publisher());
sdk.setContextDataProvider(new Provider());
sdk.getEventLogger();
sdk.getContextPublisher();
sdk.getContextDataProvider();
sdk.getClient();
sdk.getContextData(request);
const context: Context = sdk.createContext(params, contextOptions, request);
const withData = sdk.createContextWith(params, data, contextOptions);
const ready: Promise<unknown> = context.ready();
context.unit("user", 42);
context.units(units);
context.getUnit("user");
context.getUnits();
context.attribute("country", "US");
context.attributes({ age: 21 });
const value: any = context.getAttribute("country");
context.getAttributes();
context.peek("example");
context.treatment("example");
context.variableValue("color", "blue");
context.peekVariableValue("color", "blue");
context.variableKeys();
context.override("example", 1);
context.overrides({ example: 1 });
context.customAssignment("example", 1);
context.customAssignments({ example: 1 });
context.track("purchase", { amount: 5 });
context.publish();
context.refresh();
const finalized: true | Promise<void> = context.finalize();
if (finalized === true) {
	void finalized;
}
context.experiments();
context.customFieldKeys();
context.customFieldValue("example", "key");
context.customFieldValueType("example", "key");
context.isReady();
context.isFailed();
context.isFinalizing();
context.isFinalized();
context.pending();
context.data();
context.eventLogger();
context.publisher();
context.provider();
mergeConfig(withData, {});
const controller = new AbortController();
controller.abort();
void wrapped;
void payload;
void namedSdk;
void ready;
void value;

function readReleasedApplicationVersion(options: ClientOptions): number {
	return typeof options.application === "string" ? 0 : options.application.version;
}
void readReleasedApplicationVersion;

type ReleasedSdkOptions = ConstructorParameters<typeof SDK>[0];
type ReleasedClientOptions = ConstructorParameters<typeof Client>[0];
function readSdkCtorVersion(options: ReleasedSdkOptions): number {
	return typeof options.application === "string" ? 0 : options.application.version;
}
function readClientCtorVersion(options: ReleasedClientOptions): number {
	return typeof options.application === "string" ? 0 : options.application.version;
}
void readSdkCtorVersion;
void readClientCtorVersion;

import { JsonExpr } from "@absmartly/javascript-sdk/types/jsonexpr/jsonexpr";
class ReleasedExpressionImplementation implements JsonExpr {
	evaluateBooleanExpr<T>(expr: T[] | Record<string, T>, vars: Record<string, T>): any {
		return true;
	}
	evaluateExpr<T>(expr: T[] | Record<string, T>, vars: Record<string, T>): any {
		return null;
	}
}
const releasedExpression: JsonExpr = new ReleasedExpressionImplementation();
void releasedExpression;
