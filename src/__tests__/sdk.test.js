import Client from "../client";
import SDK from "../sdk";
import Context from "../context";
import { ContextPublisher } from "../publisher";
import { ContextDataProvider } from "../provider";

jest.mock("../client");
jest.mock("../context");
jest.mock("../publisher");
jest.mock("../provider");

describe("SDK", () => {
	const contextParams = {
		units: {
			session_id: "ab",
		},
	};

	const testEventLogger = jest.fn();
	const testContextDataProvider = new ContextDataProvider();
	const testContextPublisher = new ContextPublisher();

	const sdkOptions = {
		agent: "javascript-sdk",
		apiKey: "apikey",
		application: "website",
		endpoint: "localhost:8080",
		environment: "test",
		eventLogger: testEventLogger,
		publisher: testContextPublisher,
		provider: testContextDataProvider,
		timeout: 1000,
	};

	describe("constructor()", () => {
		it("should try to create a client with no options", (done) => {
			const sdk = new SDK();

			expect(sdk).toBeInstanceOf(SDK);
			expect(sdk.getEventLogger()).toBe(SDK.defaultEventLogger);
			expect(Client).toHaveBeenCalledTimes(1);
			expect(Client).toHaveBeenCalledWith({
				agent: "absmartly-javascript-sdk",
			});

			expect(ContextDataProvider).toHaveBeenCalledTimes(1);
			expect(ContextDataProvider).toHaveBeenCalledWith();

			expect(ContextPublisher).toHaveBeenCalledTimes(1);
			expect(ContextPublisher).toHaveBeenCalledWith();

			expect(sdk.getClient()).toBeInstanceOf(Client);
			expect(sdk.getContextDataProvider()).toBeInstanceOf(ContextDataProvider);
			expect(sdk.getContextPublisher()).toBeInstanceOf(ContextPublisher);

			done();
		});

		it("should create a client with specified options", (done) => {
			const sdk = new SDK(sdkOptions);

			expect(sdk).toBeInstanceOf(SDK);
			expect(sdk.getEventLogger()).toBe(testEventLogger);
			expect(sdk.getContextDataProvider()).toBe(testContextDataProvider);
			expect(sdk.getContextPublisher()).toBe(testContextPublisher);
			expect(Client).toHaveBeenCalledTimes(1);
			expect(Client).toHaveBeenCalledWith({
				agent: "javascript-sdk",
				apiKey: "apikey",
				application: "website",
				endpoint: "localhost:8080",
				environment: "test",
				timeout: 1000,
			});

			expect(sdk.getClient()).toBeInstanceOf(Client);
			expect(sdk.getContextDataProvider()).toBe(testContextDataProvider);
			expect(sdk.getContextPublisher()).toBe(testContextPublisher);

			done();
		});

		it("should set default values for unspecified client options", (done) => {
			const options = {
				application: "application",
				apiKey: "apikey",
				endpoint: "localhost:8080",
				environment: "test",
			};

			const sdk = new SDK(options);

			expect(sdk).toBeInstanceOf(SDK);
			expect(sdk.getEventLogger()).toBe(SDK.defaultEventLogger);
			expect(Client).toHaveBeenCalledTimes(1);
			expect(Client).toHaveBeenCalledWith(
				Object.assign(
					{},
					{
						agent: "absmartly-javascript-sdk",
					},
					options
				)
			);

			done();
		});
	});

	describe("getContextData()", () => {
		it("should call client getContext and return data promise", (done) => {
			const sdk = new SDK(sdkOptions);

			const promise = Promise.resolve({});
			testContextDataProvider.getContextData.mockReturnValue(promise);

			const data = sdk.getContextData(sdk);

			expect(testContextDataProvider.getContextData).toHaveBeenCalledTimes(1);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledWith(sdk);
			expect(data).toBe(promise);

			expect(Context).not.toHaveBeenCalled();

			done();
		});
	});

	describe("createContext()", () => {
		it("should create Context object with promise", (done) => {
			const sdk = new SDK(sdkOptions);

			const promise = Promise.resolve({});
			testContextDataProvider.getContextData.mockReturnValue(promise);

			const contextOptions = {
				publishDelay: 1000,
				refreshPeriod: 0,
			};

			const context = sdk.createContext(contextParams, contextOptions);

			expect(context).toBeInstanceOf(Context);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledTimes(1);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledWith(sdk);

			expect(Context).toHaveBeenCalledTimes(1);
			expect(Context).toHaveBeenCalledWith(sdk, contextOptions, contextParams, promise);

			done();
		});

		it("should coerce unit uid to string", (done) => {
			const sdk = new SDK(sdkOptions);

			const promise = Promise.resolve({});
			testContextDataProvider.getContextData.mockReturnValue(promise);

			const contextOptions = {
				publishDelay: 1000,
				refreshPeriod: 0,
			};

			const params = {
				units: {
					session_id: "ab",
					user_id: 125,
					float_id: 125.75,
				},
			};

			const context = sdk.createContext(params, contextOptions);

			expect(context).toBeInstanceOf(Context);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledTimes(1);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledWith(sdk);

			expect(Context).toHaveBeenCalledTimes(1);
			expect(Context).toHaveBeenCalledWith(sdk, contextOptions, params, promise);

			done();
		});

		it("should throw on unsupported unit uid type", (done) => {
			const sdk = new SDK(sdkOptions);

			const promise = Promise.resolve({});
			testContextDataProvider.getContextData.mockReturnValue(promise);

			const contextOptions = {
				publishDelay: 1000,
				refreshPeriod: 0,
				eventLogger: testEventLogger,
			};

			const params = {
				units: {
					session_id: true,
				},
			};

			expect(() => sdk.createContext(params, contextOptions)).toThrow(
				new Error(
					"Unit 'session_id' UID is of unsupported type 'boolean'. UID must be one of ['string', 'number']"
				)
			);
			expect(testContextDataProvider.getContextData).not.toHaveBeenCalled();
			expect(Context).not.toHaveBeenCalled();

			done();
		});

		it("should initialize context with default options for nodejs", (done) => {
			const sdk = new SDK(sdkOptions);

			const promise = Promise.resolve({});
			testContextDataProvider.getContextData.mockReturnValue(promise);

			const context = sdk.createContext(contextParams);

			const defaultOptions = {
				publishDelay: -1,
				refreshPeriod: 0,
			};

			expect(context).toBeInstanceOf(Context);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledTimes(1);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledWith(sdk);

			expect(context).toBeInstanceOf(Context);
			expect(Context).toHaveBeenCalledTimes(1);
			expect(Context).toHaveBeenCalledWith(sdk, defaultOptions, contextParams, promise);

			done();
		});

		it("should initialize context with default options for browser", (done) => {
			const sdk = new SDK(sdkOptions);

			const promise = Promise.resolve({});
			testContextDataProvider.getContextData.mockReturnValue(promise);

			// fake browser environment
			const previousWindow = global.window;
			global.window = { navigator: {} };

			const context = sdk.createContext(contextParams);

			// restore environment
			global.window = previousWindow;

			const defaultOptions = {
				publishDelay: 100,
				refreshPeriod: 0,
			};

			expect(context).toBeInstanceOf(Context);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledTimes(1);
			expect(testContextDataProvider.getContextData).toHaveBeenCalledWith(sdk);

			expect(context).toBeInstanceOf(Context);
			expect(Context).toHaveBeenCalledTimes(1);
			expect(Context).toHaveBeenCalledWith(sdk, defaultOptions, contextParams, promise);

			done();
		});
	});

	describe("createContextWith()", () => {
		it("should not call client getContext", (done) => {
			const data = {
				guid: "test",
			};

			const contextOptions = {
				publishDelay: 1000,
				refreshPeriod: 0,
				eventLogger: testEventLogger,
			};

			const sdk = new SDK(sdkOptions);
			const context = sdk.createContextWith(contextParams, data, contextOptions);

			expect(context).toBeInstanceOf(Context);
			expect(testContextDataProvider.getContextData).not.toHaveBeenCalled();

			expect(Context).toHaveBeenCalledTimes(1);
			expect(Context).toHaveBeenCalledWith(sdk, contextOptions, contextParams, data);

			done();
		});

		it("should throw on unsupported unit uid type", (done) => {
			const sdk = new SDK(sdkOptions);

			const contextOptions = {
				publishDelay: 1000,
				refreshPeriod: 0,
				eventLogger: testEventLogger,
			};

			const params = {
				units: {
					session_id: true,
				},
			};

			expect(() => sdk.createContextWith(params, contextOptions, {})).toThrow(
				new Error(
					"Unit 'session_id' UID is of unsupported type 'boolean'. UID must be one of ['string', 'number']"
				)
			);
			expect(testContextDataProvider.getContextData).not.toHaveBeenCalled();
			expect(Context).not.toHaveBeenCalled();

			done();
		});

		it("should initialize context with default options", (done) => {
			const data = {
				guid: "test",
			};

			const defaultOptions = {
				publishDelay: -1,
				refreshPeriod: 0,
			};

			const sdk = new SDK(sdkOptions);
			const context = sdk.createContextWith(contextParams, data);

			expect(context).toBeInstanceOf(Context);
			expect(Context).toHaveBeenCalledTimes(1);
			expect(Context).toHaveBeenCalledWith(sdk, defaultOptions, contextParams, data);

			done();
		});
	});

	describe("setEventLogger()", () => {
		it("should override the current logger", (done) => {
			const sdk = new SDK(sdkOptions);
			expect(sdk.getEventLogger()).toBe(testEventLogger);

			const newLogger = jest.fn();
			sdk.setEventLogger(newLogger);
			expect(sdk.getEventLogger()).toBe(newLogger);

			done();
		});
	});

	describe("setContextDataProvider()", () => {
		it("should override the current provider", (done) => {
			const sdk = new SDK(sdkOptions);
			expect(sdk.getContextDataProvider()).toBe(testContextDataProvider);

			const newProvider = new ContextDataProvider();
			sdk.setContextDataProvider(newProvider);
			expect(sdk.getContextDataProvider()).toBe(newProvider);

			done();
		});
	});

	describe("setContextPublisher()", () => {
		it("should override the current publisher", (done) => {
			const sdk = new SDK(sdkOptions);
			expect(sdk.getContextPublisher()).toBe(testContextPublisher);

			const newPublisher = new ContextPublisher();
			sdk.setContextPublisher(newPublisher);
			expect(sdk.getContextPublisher()).toBe(newPublisher);

			done();
		});
	});

	describe("defaultLogger", () => {
		it("should log only errors to console", (done) => {
			const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
			jest.spyOn(console, "warn").mockImplementation(() => {});
			jest.spyOn(console, "info").mockImplementation(() => {});
			jest.spyOn(console, "log").mockImplementation(() => {});

			for (const eventName of ["error", "ready", "refresh", "publish", "goal", "exposure"]) {
				if (eventName === "error") {
					SDK.defaultEventLogger("context", eventName, "error text");
					expect(console.error).toHaveBeenCalledTimes(1);
					expect(console.error).toHaveBeenCalledWith("error text");

					errorSpy.mockClear();
				} else {
					SDK.defaultEventLogger("context", eventName, {});
					expect(console.error).toHaveBeenCalledTimes(0);
				}
				expect(console.warn).toHaveBeenCalledTimes(0);
				expect(console.info).toHaveBeenCalledTimes(0);
				expect(console.log).toHaveBeenCalledTimes(0);
			}

			done();
		});
	});
});
